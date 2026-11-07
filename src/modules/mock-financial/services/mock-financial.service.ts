import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { LedgerService } from '../../ledger/ledger.service';
import { RecipientsService } from '../../recipients/recipients.service';
import {
  TransactionState,
  TransactionType,
  EntryDirection,
  CustomerStatus,
  KycTier,
  LedgerAccountType,
} from '@prisma/client';
import { CHART_OF_ACCOUNTS } from '../../../common/constants';
import { formatKoboToNaira } from '../../../common/types';
import {
  MOCK_FINANCIAL_CONSTANTS,
  MOCK_VAS_PACKAGES,
  MOCK_BANKS,
  resolveCorridor,
  type MockPaymentDestinationType,
} from '../mock-financial.constants';
import {
  MockAccountBalance,
  MockTransactionSummary,
  MockTransferPreview,
  MockTransferExecutionResult,
  MockCrossBorderPreview,
  MockDepositResult,
  MockWithdrawalResult,
  MockVasResult,
  MockGiftResult,
  MockRecipientSummary,
} from '../interfaces/mock-financial.interface';
import {
  FinancialInvariantException,
  InsufficientFundsException,
  UnauthorizedTransactionException,
} from '../../../common/exceptions';
import * as crypto from 'crypto';

@Injectable()
export class MockFinancialService {
  private readonly logger = new Logger(MockFinancialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly recipientsService: RecipientsService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Customer Identification & Isolation
  // ---------------------------------------------------------------------------

  /**
   * Resolves or provisions a mock customer by normalized WhatsApp phone number.
   * Ensures account isolation: every customer has a dedicated liability ledger account.
   */
  async resolveMockCustomer(
    whatsappNumber: string,
    defaultName = 'Mock Customer',
  ) {
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');

    let customer = await this.prisma.customerProfile.findUnique({
      where: { whatsappNumber: cleanNumber },
      include: { user: true },
    });

    if (!customer) {
      this.logger.log(`[MOCK] Auto-provisioning mock customer for WhatsApp: ${cleanNumber}`);

      const user = await this.prisma.user.upsert({
        where: { phoneNumber: cleanNumber },
        update: {},
        create: {
          phoneNumber: cleanNumber,
          role: 'CUSTOMER',
          isActive: true,
        },
      });

      const virtualAccount = `01${cleanNumber.slice(-8)}`;

      customer = await this.prisma.customerProfile.create({
        data: {
          userId: user.id,
          whatsappNumber: cleanNumber,
          fullName: defaultName,
          status: CustomerStatus.ACTIVE,
          kycTier: KycTier.TIER_2,
          dailyLimitKobo: MOCK_FINANCIAL_CONSTANTS.MAX_DAILY_LIMIT_KOBO,
          accountReference: virtualAccount,
        },
        include: { user: true },
      });

      // Ensure customer deposit liability account exists
      await this.ensureCustomerAccount(customer.id, customer.fullName);
    }

    return customer;
  }

  // ---------------------------------------------------------------------------
  // 2. Balance Enquiry
  // ---------------------------------------------------------------------------

  /**
   * Returns customer's simulated available balance from the double-entry ledger.
   */
  async getBalance(customerId: string): Promise<MockAccountBalance> {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Mock customer ${customerId} not found.`);
    }

    let account = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${customerId}` },
    });

    if (!account) {
      // Registered customers may not have a ledger account yet — provision it
      // (with the starter balance) so balance enquiries always resolve.
      await this.ensureCustomerAccount(customer.id, customer.fullName);
      account = await this.prisma.ledgerAccount.findUnique({
        where: { accountNumber: `21000-${customerId}` },
      });
    }

    const balanceKobo = account?.balanceKobo ?? 0n;
    const virtualAccount = customer.accountReference || `01${customer.whatsappNumber.slice(-8)}`;

    return {
      customerId,
      customerName: customer.fullName,
      accountNumber: virtualAccount,
      bankName: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_NAME,
      currency: 'NGN',
      availableBalanceKobo: balanceKobo,
      isSimulated: true,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Transaction History
  // ---------------------------------------------------------------------------

  /**
   * Retrieves recent simulated transactions for customer (last 5, last 10, or custom limit).
   */
  async getTransactionHistory(
    customerId: string,
    limit = 5,
  ): Promise<MockTransactionSummary[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 20),
    });

    return transactions.map((t) => ({
      id: t.id,
      reference: t.internalReference,
      type: t.type,
      state: t.state,
      amountKobo: t.amountKobo,
      feeKobo: t.feeKobo,
      currency: t.currency,
      recipientName: t.destinationAccountName || undefined,
      destinationAccount: t.destinationAccountNumber || undefined,
      narration: t.recipientAlias || undefined,
      createdAt: t.createdAt,
      isSimulated: t.isSimulated,
    }));
  }

  /**
   * Fetches full transaction details by internal reference.
   */
  async getTransactionByReference(
    customerId: string,
    reference: string,
  ): Promise<MockTransactionSummary | null> {
    const txn = await this.prisma.transaction.findFirst({
      where: {
        customerId,
        internalReference: reference,
      },
    });

    if (!txn) return null;

    return {
      id: txn.id,
      reference: txn.internalReference,
      type: txn.type,
      state: txn.state,
      amountKobo: txn.amountKobo,
      feeKobo: txn.feeKobo,
      currency: txn.currency,
      recipientName: txn.destinationAccountName || undefined,
      destinationAccount: txn.destinationAccountNumber || undefined,
      narration: txn.recipientAlias || undefined,
      createdAt: txn.createdAt,
      isSimulated: txn.isSimulated,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Internal Simulated Transfers (2-Phase: Intent -> Confirmation)
  // ---------------------------------------------------------------------------

  /**
   * Phase 1: Validates transfer parameters, resolves recipient, and issues confirmation challenge.
   */
  /**
   * Resolves recipient across personal saved contacts, registered system users, and seeded aliases.
   */
  async resolveDestinationRecipient(
    senderCustomerId: string,
    query: string,
  ): Promise<{
    accountNumber: string;
    accountName: string;
    bankCode: string;
    bankName: string;
    alias: string;
    internalCustomerId?: string;
  }> {
    const raw = query.trim();
    const cleanLower = raw.toLowerCase();
    const cleanDigits = raw.replace(/[^0-9]/g, '');

    // 1. Check sender's personal saved recipients via RecipientsService
    try {
      const resolved = await this.recipientsService.resolveRecipient(senderCustomerId, raw);
      if (resolved) {
        return {
          accountNumber: resolved.accountNumber,
          accountName: resolved.accountName,
          bankCode: resolved.bankCode,
          bankName: resolved.bankName,
          alias: raw,
        };
      }
    } catch {
      // Continue to next resolution strategy
    }

    // 2. Search other registered mock customers in CustomerProfile
    // By account reference or phone (exact digits match)
    if (cleanDigits.length >= 7) {
      const matchedByNumber = await this.prisma.customerProfile.findFirst({
        where: {
          OR: [
            { accountReference: cleanDigits },
            { whatsappNumber: cleanDigits },
          ],
        },
      });
      if (matchedByNumber && matchedByNumber.id !== senderCustomerId) {
        return {
          accountNumber: matchedByNumber.accountReference || `01${matchedByNumber.whatsappNumber.slice(-8)}`,
          accountName: matchedByNumber.fullName,
          bankCode: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_CODE,
          bankName: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_NAME,
          alias: matchedByNumber.fullName,
          internalCustomerId: matchedByNumber.id,
        };
      }
    }

    // By Name match in CustomerProfile
    const allCustomers = await this.prisma.customerProfile.findMany();
    const otherCustomers = allCustomers.filter((c) => c.id !== senderCustomerId);

    // Common nickname mappings
    const nicknameMap: Record<string, string> = {
      bayo: 'adebayo',
      ade: 'adebayo',
      tunde: 'babatunde',
      baba: 'babatunde',
      chi: 'chioma',
      oma: 'chioma',
    };
    const targetName = nicknameMap[cleanLower] || cleanLower;

    const matchedByName = otherCustomers.find((c) =>
      c.fullName.toLowerCase().includes(targetName) ||
      (c.accountReference && c.accountReference === cleanDigits),
    );

    if (matchedByName) {
      return {
        accountNumber: matchedByName.accountReference || `01${matchedByName.whatsappNumber.slice(-8)}`,
        accountName: matchedByName.fullName,
        bankCode: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_CODE,
        bankName: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_NAME,
        alias: matchedByName.fullName,
        internalCustomerId: matchedByName.id,
      };
    }

    // 3. Known friendly relation aliases (Mum, Sister, Landlord, John, Wife, Brother)
    const seededAliases: Record<string, { name: string; account: string; bankCode: string; bankName: string }> = {
      mum: { name: 'Jane Adeleke', account: '0111222333', bankCode: '058', bankName: 'Guaranty Trust Bank' },
      mom: { name: 'Jane Adeleke', account: '0111222333', bankCode: '058', bankName: 'Guaranty Trust Bank' },
      mother: { name: 'Jane Adeleke', account: '0111222333', bankCode: '058', bankName: 'Guaranty Trust Bank' },
      sister: { name: 'Grace Adeleke', account: '0222333444', bankCode: '044', bankName: 'Access Bank' },
      landlord: { name: 'Chief Okon', account: '0333444555', bankCode: '057', bankName: 'Zenith Bank' },
      john: { name: 'John Doe', account: '0444555666', bankCode: '011', bankName: 'First Bank' },
      brother: { name: 'Emeka Okonkwo', account: '0555666777', bankCode: '033', bankName: 'United Bank for Africa' },
      wife: { name: 'Fatima Adeleke', account: '0666777888', bankCode: '011', bankName: 'First Bank of Nigeria' },
    };

    if (seededAliases[cleanLower]) {
      const aliasData = seededAliases[cleanLower];
      return {
        accountNumber: aliasData.account,
        accountName: aliasData.name,
        bankCode: aliasData.bankCode,
        bankName: aliasData.bankName,
        alias: raw,
      };
    }

    // 4. Default simulated external bank recipient
    return {
      accountNumber: '9999999999',
      accountName: raw.toUpperCase(),
      bankCode: '058',
      bankName: 'Guaranty Trust Bank (Simulated)',
      alias: raw,
    };
  }

  /**
   * Phase 1 (Batch): Creates preview for multiple simultaneous transfers in one message.
   */
  async createBatchTransferPreview(
    senderCustomerId: string,
    transfers: Array<{ amountKobo: bigint; recipient: string }>,
  ): Promise<{
    previews: MockTransferPreview[];
    totalAmountKobo: bigint;
    totalFeeKobo: bigint;
    totalDebitKobo: bigint;
    expiresInMinutes: number;
  }> {
    const sender = await this.prisma.customerProfile.findUnique({
      where: { id: senderCustomerId },
    });
    if (!sender) {
      throw new NotFoundException(`Sender customer ${senderCustomerId} not found.`);
    }

    const feePerTransfer = MOCK_FINANCIAL_CONSTANTS.DEFAULT_TRANSFER_FEE_KOBO;
    let totalAmount = 0n;
    let totalFee = 0n;

    for (const t of transfers) {
      if (t.amountKobo <= 0n) {
        throw new FinancialInvariantException('All transfer amounts must be strictly positive.');
      }
      totalAmount += t.amountKobo;
      totalFee += feePerTransfer;
    }

    const totalRequired = totalAmount + totalFee;

    // Check sender available balance
    let senderAccount = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${senderCustomerId}` },
    });
    if (!senderAccount || senderAccount.balanceKobo === 0n) {
      await this.ensureCustomerAccount(senderCustomerId, sender.fullName);
      senderAccount = await this.prisma.ledgerAccount.findUnique({
        where: { accountNumber: `21000-${senderCustomerId}` },
      });
    }
    const currentBalance = senderAccount?.balanceKobo ?? 0n;

    if (currentBalance < totalRequired) {
      throw new InsufficientFundsException(
        `Insufficient funds for multiple transfers. Required: ₦${Number(totalRequired) / 100}, Available: ₦${Number(currentBalance) / 100}`,
      );
    }

    const previews: MockTransferPreview[] = [];
    const batchExpiryMinutes = MOCK_FINANCIAL_CONSTANTS.CONFIRMATION_EXPIRY_MINUTES;

    for (const t of transfers) {
      const recipientInfo = await this.resolveDestinationRecipient(senderCustomerId, t.recipient);
      const internalReference = `MOCK_TXN_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const challengeToken = crypto.randomBytes(12).toString('hex');
      const expiresAt = new Date(Date.now() + batchExpiryMinutes * 60 * 1000);

      const txn = await this.prisma.transaction.create({
        data: {
          internalReference,
          idempotencyKey: `IDEMP_${internalReference}`,
          customerId: senderCustomerId,
          type: TransactionType.TRANSFER,
          state: TransactionState.AWAITING_AUTHORIZATION,
          amountKobo: t.amountKobo,
          feeKobo: feePerTransfer,
          currency: 'NGN',
          destinationAccountNumber: recipientInfo.accountNumber,
          destinationBankCode: recipientInfo.bankCode,
          destinationAccountName: recipientInfo.accountName,
          recipientAlias: recipientInfo.alias,
          isSimulated: true,
        },
      });

      await this.prisma.transactionAuthorization.create({
        data: {
          transactionId: txn.id,
          challengeToken,
          expiresAt,
        },
      });

      previews.push({
        transactionId: txn.id,
        internalReference,
        amountKobo: t.amountKobo,
        feeKobo: feePerTransfer,
        totalDebitKobo: t.amountKobo + feePerTransfer,
        currency: 'NGN',
        recipientName: recipientInfo.accountName,
        recipientAccountNumber: recipientInfo.accountNumber,
        recipientBankName: recipientInfo.bankName,
        challengeToken,
        expiresInMinutes: batchExpiryMinutes,
        isSimulated: true,
      });
    }

    return {
      previews,
      totalAmountKobo: totalAmount,
      totalFeeKobo: totalFee,
      totalDebitKobo: totalRequired,
      expiresInMinutes: batchExpiryMinutes,
    };
  }

  async createTransferPreview(
    senderCustomerId: string,
    recipientAliasOrAccount: string,
    amountKobo: bigint,
  ): Promise<MockTransferPreview> {
    if (amountKobo <= 0n) {
      throw new FinancialInvariantException('Transfer amount must be strictly positive.');
    }

    const sender = await this.prisma.customerProfile.findUnique({
      where: { id: senderCustomerId },
    });
    if (!sender) {
      throw new NotFoundException(`Sender customer ${senderCustomerId} not found.`);
    }

    if (amountKobo > sender.dailyLimitKobo) {
      throw new BadRequestException(
        `Amount exceeds daily limit of ₦${Number(sender.dailyLimitKobo) / 100}`,
      );
    }

    const feeKobo = MOCK_FINANCIAL_CONSTANTS.DEFAULT_TRANSFER_FEE_KOBO;
    const totalRequiredKobo = amountKobo + feeKobo;

    // Check sender available balance
    const senderAccount = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${senderCustomerId}` },
    });
    const currentBalance = senderAccount?.balanceKobo ?? 0n;

    if (currentBalance < totalRequiredKobo) {
      throw new InsufficientFundsException(
        `Insufficient funds. Required: ₦${Number(totalRequiredKobo) / 100}, Available: ₦${Number(currentBalance) / 100}`,
      );
    }

    // Resolve Recipient (saved alias/recipient, another mock customer, or external)
    const recipientInfo = await this.resolveDestinationRecipient(
      senderCustomerId,
      recipientAliasOrAccount,
    );

    // Prevent self-transfer
    const senderVirtualAccount = sender.accountReference || `01${sender.whatsappNumber.slice(-8)}`;
    if (
      recipientInfo.accountNumber === senderVirtualAccount ||
      (recipientInfo.internalCustomerId && recipientInfo.internalCustomerId === senderCustomerId)
    ) {
      throw new BadRequestException('Self-transfers are not permitted.');
    }

    // Generate reference and authorization token
    const internalReference = `MOCK_TXN_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const challengeToken = crypto.randomBytes(12).toString('hex');
    const expiresAt = new Date(
      Date.now() + MOCK_FINANCIAL_CONSTANTS.CONFIRMATION_EXPIRY_MINUTES * 60 * 1000,
    );

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          internalReference,
          idempotencyKey: `IDEMP_${internalReference}`,
          customerId: senderCustomerId,
          type: TransactionType.TRANSFER,
          state: TransactionState.AWAITING_AUTHORIZATION,
          amountKobo,
          feeKobo,
          currency: 'NGN',
          destinationAccountNumber: recipientInfo.accountNumber,
          destinationBankCode: recipientInfo.bankCode,
          destinationAccountName: recipientInfo.accountName,
          recipientAlias: recipientInfo.alias,
          isSimulated: true,
        },
      });

      await tx.transactionAuthorization.create({
        data: {
          transactionId: created.id,
          challengeToken,
          expiresAt,
        },
      });

      return created;
    });

    return {
      transactionId: transaction.id,
      internalReference,
      amountKobo,
      feeKobo,
      totalDebitKobo: totalRequiredKobo,
      currency: 'NGN',
      recipientName: recipientInfo.accountName,
      recipientAccountNumber: recipientInfo.accountNumber,
      recipientBankName: recipientInfo.bankName,
      challengeToken,
      expiresInMinutes: MOCK_FINANCIAL_CONSTANTS.CONFIRMATION_EXPIRY_MINUTES,
      isSimulated: true,
    };
  }

  /**
   * Creates a pending preview for a simulated cross-border payment
   * (African corridor / China supplier) or a vendor payment.
   * The pending transaction is executed by the shared confirmTransfer flow.
   */
  async createCrossBorderPreview(
    senderCustomerId: string,
    params: {
      destinationType: MockPaymentDestinationType;
      country?: string;
      recipientName?: string;
      amountKobo: bigint;
    },
  ): Promise<MockCrossBorderPreview> {
    const { destinationType, amountKobo } = params;
    if (amountKobo <= 0n) {
      throw new FinancialInvariantException('Payment amount must be strictly positive.');
    }

    const sender = await this.prisma.customerProfile.findUnique({
      where: { id: senderCustomerId },
    });
    if (!sender) {
      throw new NotFoundException(`Sender customer ${senderCustomerId} not found.`);
    }

    if (amountKobo > sender.dailyLimitKobo) {
      throw new BadRequestException(
        `Amount exceeds daily limit of ₦${Number(sender.dailyLimitKobo) / 100}`,
      );
    }

    const corridor = resolveCorridor(destinationType, params.country);
    if (destinationType !== 'VENDOR' && !corridor) {
      throw new BadRequestException(
        `Unsupported destination: ${params.country || destinationType}. Supported: Cameroon, Ghana, Kenya, South Africa, Uganda, Tanzania, Côte d'Ivoire, Senegal, Rwanda, China.`,
      );
    }

    const feeKobo =
      destinationType === 'VENDOR'
        ? MOCK_FINANCIAL_CONSTANTS.DEFAULT_TRANSFER_FEE_KOBO
        : destinationType === 'CHINA'
          ? MOCK_FINANCIAL_CONSTANTS.CROSS_BORDER_FEE_KOBO.CHINA
          : MOCK_FINANCIAL_CONSTANTS.CROSS_BORDER_FEE_KOBO.AFRICA;

    const totalRequiredKobo = amountKobo + feeKobo;

    const senderAccount = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${senderCustomerId}` },
    });
    const currentBalance = senderAccount?.balanceKobo ?? 0n;
    if (currentBalance < totalRequiredKobo) {
      throw new InsufficientFundsException(
        `Insufficient funds. Required: ₦${Number(totalRequiredKobo) / 100}, Available: ₦${Number(currentBalance) / 100}`,
      );
    }

    const recipientName =
      params.recipientName?.trim() ||
      (corridor ? `${corridor.country} Supplier` : 'Vendor');

    const recipientAccountNumber = corridor
      ? `${corridor.iso}-${corridor.currency}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      : `VEN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const recipientBankName = corridor
      ? corridor.railLabel
      : MOCK_BANKS['058'] || 'Commercial Bank';

    const internalReference = `MOCK_PAY_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const challengeToken = crypto.randomBytes(12).toString('hex');
    const expiresAt = new Date(
      Date.now() + MOCK_FINANCIAL_CONSTANTS.CONFIRMATION_EXPIRY_MINUTES * 60 * 1000,
    );

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          internalReference,
          idempotencyKey: `IDEMP_${internalReference}`,
          customerId: senderCustomerId,
          type: TransactionType.PAYMENT,
          state: TransactionState.AWAITING_AUTHORIZATION,
          amountKobo,
          feeKobo,
          currency: 'NGN',
          destinationAccountNumber: recipientAccountNumber,
          destinationBankCode: recipientBankName,
          destinationAccountName: recipientName,
          recipientAlias: corridor
            ? `${corridor.flag} ${corridor.country} · ${corridor.currency}`
            : `Vendor · ${recipientName}`,
          isSimulated: true,
        },
      });

      await tx.transactionAuthorization.create({
        data: {
          transactionId: created.id,
          challengeToken,
          expiresAt,
        },
      });

      return created;
    });

    let foreignAmountText: string | undefined;
    let rateText: string | undefined;
    if (corridor) {
      const foreignUnits = (Number(amountKobo) / 100) * corridor.perNaira;
      foreignAmountText = `${foreignUnits.toLocaleString('en-US', {
        maximumFractionDigits: 2,
      })} ${corridor.currency}`;
      rateText = `₦1 ≈ ${Number(corridor.perNaira.toFixed(4))} ${corridor.currency}`;
    }

    return {
      transactionId: transaction.id,
      internalReference,
      amountKobo,
      feeKobo,
      totalDebitKobo: totalRequiredKobo,
      currency: 'NGN',
      recipientName,
      recipientAccountNumber,
      recipientBankName,
      challengeToken,
      expiresInMinutes: MOCK_FINANCIAL_CONSTANTS.CONFIRMATION_EXPIRY_MINUTES,
      isSimulated: true,
      destinationType,
      country: corridor?.country,
      flag: corridor?.flag,
      foreignCurrency: corridor?.currency,
      foreignAmountText,
      rateText,
    };
  }

  /**
   * Phase 2: Authorizes and atomically executes a pending transfer upon explicit confirmation.
   */
  /**
   * Authorizes and atomically executes a batch of pending transfers.
   */
  private async executeBatchConfirm(
    senderCustomerId: string,
    pendingTxns: any[],
  ): Promise<MockTransferExecutionResult> {
    const validTxns = pendingTxns.filter((t) => {
      const a = (t.authorizations || []).find((auth: any) => !auth.isUsed);
      return a && a.expiresAt > new Date();
    });

    if (validTxns.length === 0) {
      throw new UnauthorizedTransactionException('All transaction authorizations expired.');
    }

    let totalRequiredKobo = 0n;
    for (const t of validTxns) {
      totalRequiredKobo += t.amountKobo + t.feeKobo;
    }

    const senderAccountNum = `21000-${senderCustomerId}`;
    const senderAccount = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: senderAccountNum },
    });

    if (!senderAccount || senderAccount.balanceKobo < totalRequiredKobo) {
      for (const t of validTxns) {
        await this.prisma.transaction.update({
          where: { id: t.id },
          data: { state: TransactionState.FAILED, failureReason: 'Insufficient balance at execution' },
        });
      }
      throw new InsufficientFundsException('Insufficient funds to complete batch transfers.');
    }

    const executedItems: Array<{ recipientName: string; amountKobo: bigint; reference: string }> = [];

    for (const t of validTxns) {
      const destinationAccountNum = t.destinationAccountNumber!;
      const internalRecipient = await this.prisma.customerProfile.findFirst({
        where: {
          OR: [
            { accountReference: destinationAccountNum },
            { whatsappNumber: destinationAccountNum },
          ],
        },
      });

      const clearingAccount = internalRecipient
        ? `21000-${internalRecipient.id}`
        : CHART_OF_ACCOUNTS.PROVIDER_CLEARING;

      const singleRequired = t.amountKobo + t.feeKobo;

      await this.ledgerService.postJournal({
        reference: `JRN_MOCK_${t.internalReference}`,
        idempotencyKey: `IDEMP_JRN_${t.internalReference}`,
        description: `Simulated transfer to ${t.destinationAccountName}`,
        transactionId: t.id,
        entries: [
          {
            accountNumber: senderAccountNum,
            direction: EntryDirection.DEBIT,
            amountKobo: singleRequired,
          },
          {
            accountNumber: clearingAccount,
            direction: EntryDirection.CREDIT,
            amountKobo: t.amountKobo,
          },
          {
            accountNumber: CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE,
            direction: EntryDirection.CREDIT,
            amountKobo: t.feeKobo,
          },
        ],
      });

      await this.prisma.transaction.update({
        where: { id: t.id },
        data: {
          state: TransactionState.SUCCESSFUL,
          providerReference: `SIM_RAILS_${t.internalReference}`,
        },
      });

      const auth = (t.authorizations || []).find((a: any) => !a.isUsed);
      if (auth) {
        await this.prisma.transactionAuthorization.update({
          where: { id: auth.id },
          data: { isUsed: true },
        });
      }

      executedItems.push({
        recipientName: t.destinationAccountName || t.recipientAlias || 'Recipient',
        amountKobo: t.amountKobo,
        reference: t.internalReference,
      });
    }

    const newBalance = (await this.getBalance(senderCustomerId)).availableBalanceKobo;

    return {
      transactionId: validTxns[0].id,
      internalReference: validTxns[0].internalReference,
      amountKobo: totalRequiredKobo,
      feeKobo: BigInt(validTxns.length) * MOCK_FINANCIAL_CONSTANTS.DEFAULT_TRANSFER_FEE_KOBO,
      totalDebitedKobo: totalRequiredKobo,
      recipientName: validTxns.map((t) => t.destinationAccountName).join(', '),
      recipientAccountNumber: validTxns.map((t) => t.destinationAccountNumber).join(', '),
      recipientBankName: 'WAPPay Mock Rails',
      newBalanceKobo: newBalance,
      status: 'SUCCESSFUL',
      settlementMessage: `${validTxns.length} transfers executed successfully.`,
      batchItems: executedItems,
      isSimulated: true,
    };
  }

  async confirmTransfer(
    senderCustomerId: string,
    confirmationInput: string,
  ): Promise<MockTransferExecutionResult> {
    const cleanConfirm = confirmationInput.trim().toLowerCase();
    const isAffirmative =
      cleanConfirm === 'yes' ||
      cleanConfirm === 'confirm' ||
      cleanConfirm === 'proceed' ||
      cleanConfirm === 'ok' ||
      cleanConfirm === 'y';

    if (!isAffirmative && !/^\d{4}$/.test(cleanConfirm)) {
      throw new BadRequestException(
        'Invalid confirmation response. Reply "YES" to confirm or "CANCEL" to abort.',
      );
    }

    // Find all active pending transactions for this customer
    const pendingTxns = await this.prisma.transaction.findMany({
      where: {
        customerId: senderCustomerId,
        state: TransactionState.AWAITING_AUTHORIZATION,
      },
      include: { authorizations: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!pendingTxns || pendingTxns.length === 0) {
      throw new NotFoundException('No pending transfer found awaiting confirmation.');
    }

    // Check if this was a batch transfer or single transfer
    if (pendingTxns.length > 1) {
      return await this.executeBatchConfirm(senderCustomerId, pendingTxns);
    }

    const txn = pendingTxns[0];

    const auth = txn.authorizations.find((a) => !a.isUsed);
    if (!auth || auth.expiresAt < new Date()) {
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data: { state: TransactionState.CANCELLED, failureReason: 'Confirmation expired' },
      });
      throw new UnauthorizedTransactionException('Transaction confirmation expired. Please start over.');
    }

    // Revalidate sender balance before executing
    const totalRequiredKobo = txn.amountKobo + txn.feeKobo;
    const senderAccount = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${senderCustomerId}` },
    });

    if (!senderAccount || senderAccount.balanceKobo < totalRequiredKobo) {
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data: { state: TransactionState.FAILED, failureReason: 'Insufficient balance at execution' },
      });
      throw new InsufficientFundsException('Insufficient funds to complete transfer.');
    }

    // Execute atomic transfer & balanced double-entry ledger entries
    const senderAccountNum = `21000-${senderCustomerId}`;
    const destinationAccountNum = txn.destinationAccountNumber!;

    // Check if recipient is internal mock customer
    const internalRecipient = await this.prisma.customerProfile.findFirst({
      where: {
        OR: [
          { accountReference: destinationAccountNum },
          { whatsappNumber: destinationAccountNum },
        ],
      },
    });

    const clearingAccount = internalRecipient
      ? `21000-${internalRecipient.id}`
      : CHART_OF_ACCOUNTS.PROVIDER_CLEARING;

    // Post Balanced Double-Entry Journal
    // Debit sender liability (balance decreases)
    // Credit destination account / clearing (balance increases)
    // Credit fee revenue (revenue increases)
    // Total Debits = totalRequiredKobo. Total Credits = txn.amountKobo + txn.feeKobo = totalRequiredKobo.
    await this.ledgerService.postJournal({
      reference: `JRN_MOCK_${txn.internalReference}`,
      idempotencyKey: `IDEMP_JRN_${txn.internalReference}`,
      description: `Simulated transfer to ${txn.destinationAccountName}`,
      transactionId: txn.id,
      entries: [
        {
          accountNumber: senderAccountNum,
          direction: EntryDirection.DEBIT,
          amountKobo: totalRequiredKobo,
        },
        {
          accountNumber: clearingAccount,
          direction: EntryDirection.CREDIT,
          amountKobo: txn.amountKobo,
        },
        {
          accountNumber: CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE,
          direction: EntryDirection.CREDIT,
          amountKobo: txn.feeKobo,
        },
      ],
    });

    // Update Transaction State to SUCCESSFUL & mark auth used
    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: txn.id },
        data: {
          state: TransactionState.SUCCESSFUL,
          providerReference: `SIM_RAILS_${txn.internalReference}`,
        },
      }),
      this.prisma.transactionAuthorization.update({
        where: { id: auth.id },
        data: { isUsed: true, authorizedAt: new Date() },
      }),
    ]);

    const updatedBalance = (await this.getBalance(senderCustomerId)).availableBalanceKobo;
    const isPayment = txn.type === TransactionType.PAYMENT;

    return {
      transactionId: txn.id,
      internalReference: txn.internalReference,
      amountKobo: txn.amountKobo,
      feeKobo: txn.feeKobo,
      totalDebitedKobo: totalRequiredKobo,
      recipientName: txn.destinationAccountName || 'Beneficiary',
      recipientAccountNumber: txn.destinationAccountNumber || '',
      recipientBankName:
        MOCK_BANKS[txn.destinationBankCode || '999'] ||
        txn.destinationBankCode ||
        'Commercial Bank',
      newBalanceKobo: updatedBalance,
      status: 'SUCCESSFUL',
      transactionType: txn.type,
      settlementMessage: isPayment
        ? 'Payment simulated successfully on cross-border/vendor mock rails.'
        : 'Transfer simulated successfully on internal mock rails.',
      isSimulated: true,
    };
  }

  /**
   * Explicitly cancels customer's active pending transfer.
   */
  async cancelPendingTransfer(senderCustomerId: string): Promise<string> {
    const txn = await this.prisma.transaction.findFirst({
      where: {
        customerId: senderCustomerId,
        state: TransactionState.AWAITING_AUTHORIZATION,
      },
      include: { authorizations: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!txn) {
      return 'You have no pending transfer to cancel.';
    }

    await this.prisma.transaction.update({
      where: { id: txn.id },
      data: {
        state: TransactionState.CANCELLED,
        failureReason: 'Cancelled by customer',
      },
    });

    for (const auth of txn.authorizations) {
      if (!auth.isUsed) {
        await this.prisma.transactionAuthorization.update({
          where: { id: auth.id },
          data: { isUsed: true },
        });
      }
    }

    return `Your pending transfer of ${formatKoboToNaira(txn.amountKobo)} has been cancelled. No funds were debited.`;
  }

  // ---------------------------------------------------------------------------
  // 5. Simulated Deposits
  // ---------------------------------------------------------------------------

  /**
   * Increases simulated account balance through an explicitly identified test operation.
   * Debits PARTNER_SETTLEMENT_ESCROW (Asset), credits customer account (Liability).
   */
  async simulateDeposit(
    customerId: string,
    amountKobo: bigint,
    narration = 'Simulated Test Deposit',
  ): Promise<MockDepositResult> {
    if (amountKobo <= 0n) {
      throw new FinancialInvariantException('Deposit amount must be strictly positive.');
    }

    const reference = `MOCK_DEP_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await this.ensureCustomerAccount(customerId);

    // Create Transaction Record
    const txn = await this.prisma.transaction.create({
      data: {
        internalReference: reference,
        idempotencyKey: `IDEMP_${reference}`,
        customerId,
        type: TransactionType.DEPOSIT,
        state: TransactionState.SUCCESSFUL,
        amountKobo,
        feeKobo: 0n,
        currency: 'NGN',
        recipientAlias: narration,
        isSimulated: true,
      },
    });

    // Double-Entry Ledger:
    // Debit: Partner Settlement Escrow (Asset increases)
    // Credit: Customer Deposits (Liability increases)
    await this.ledgerService.postJournal({
      reference: `JRN_${reference}`,
      idempotencyKey: `IDEMP_JRN_${reference}`,
      description: narration,
      transactionId: txn.id,
      entries: [
        {
          accountNumber: CHART_OF_ACCOUNTS.PARTNER_SETTLEMENT_ESCROW,
          direction: EntryDirection.DEBIT,
          amountKobo,
        },
        {
          accountNumber: `21000-${customerId}`,
          direction: EntryDirection.CREDIT,
          amountKobo,
        },
      ],
    });

    const newBalance = (await this.getBalance(customerId)).availableBalanceKobo;

    return {
      transactionId: txn.id,
      reference,
      amountCreditedKobo: amountKobo,
      newBalanceKobo: newBalance,
      status: 'SUCCESSFUL',
      isSimulated: true,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Simulated Withdrawals
  // ---------------------------------------------------------------------------

  /**
   * Reduces simulated balance only when sufficient funds exist.
   * Debits customer account (Liability), credits PARTNER_SETTLEMENT_ESCROW (Asset).
   */
  async simulateWithdrawal(
    customerId: string,
    amountKobo: bigint,
  ): Promise<MockWithdrawalResult> {
    if (amountKobo <= 0n) {
      throw new FinancialInvariantException('Withdrawal amount must be strictly positive.');
    }

    const currentBalance = (await this.getBalance(customerId)).availableBalanceKobo;
    if (currentBalance < amountKobo) {
      throw new InsufficientFundsException(
        `Insufficient funds. Requested: ₦${Number(amountKobo) / 100}, Available: ₦${Number(currentBalance) / 100}`,
      );
    }

    const reference = `MOCK_WTH_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const txn = await this.prisma.transaction.create({
      data: {
        internalReference: reference,
        idempotencyKey: `IDEMP_${reference}`,
        customerId,
        type: TransactionType.WITHDRAWAL,
        state: TransactionState.SUCCESSFUL,
        amountKobo,
        feeKobo: 0n,
        currency: 'NGN',
        recipientAlias: 'Simulated Cashout',
        isSimulated: true,
      },
    });

    // Double-Entry Ledger:
    // Debit: Customer Deposits (Liability decreases)
    // Credit: Partner Settlement Escrow (Asset decreases)
    await this.ledgerService.postJournal({
      reference: `JRN_${reference}`,
      idempotencyKey: `IDEMP_JRN_${reference}`,
      description: 'Simulated cashout withdrawal',
      transactionId: txn.id,
      entries: [
        {
          accountNumber: `21000-${customerId}`,
          direction: EntryDirection.DEBIT,
          amountKobo,
        },
        {
          accountNumber: CHART_OF_ACCOUNTS.PARTNER_SETTLEMENT_ESCROW,
          direction: EntryDirection.CREDIT,
          amountKobo,
        },
      ],
    });

    const newBalance = (await this.getBalance(customerId)).availableBalanceKobo;

    return {
      transactionId: txn.id,
      reference,
      amountDebitedKobo: amountKobo,
      newBalanceKobo: newBalance,
      status: 'SUCCESSFUL',
      isSimulated: true,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Simulated Airtime & Data Purchases
  // ---------------------------------------------------------------------------

  /**
   * Simulates an airtime top-up without calling external telcos.
   */
  async simulateAirtimePurchase(
    customerId: string,
    phone: string,
    network: string,
    amountKobo: bigint,
  ): Promise<MockVasResult> {
    if (amountKobo <= 0n) {
      throw new FinancialInvariantException('Airtime amount must be strictly positive.');
    }

    const currentBalance = (await this.getBalance(customerId)).availableBalanceKobo;
    if (currentBalance < amountKobo) {
      throw new InsufficientFundsException('Insufficient balance for airtime purchase.');
    }

    const cleanNetwork = network.toUpperCase();
    const reference = `MOCK_AIR_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const txn = await this.prisma.transaction.create({
      data: {
        internalReference: reference,
        idempotencyKey: `IDEMP_${reference}`,
        customerId,
        type: TransactionType.AIRTIME_PURCHASE,
        state: TransactionState.SUCCESSFUL,
        amountKobo,
        feeKobo: 0n,
        currency: 'NGN',
        destinationAccountNumber: phone,
        recipientAlias: `${cleanNetwork} Airtime`,
        isSimulated: true,
      },
    });

    // Double-Entry:
    // Debit: Customer Deposits (amount)
    // Credit: Provider Clearing (amount - commission)
    // Credit: VAS Commission Revenue (commission e.g. 2%)
    const commissionKobo = (amountKobo * 2n) / 100n;
    const providerCostKobo = amountKobo - commissionKobo;

    await this.ledgerService.postJournal({
      reference: `JRN_${reference}`,
      idempotencyKey: `IDEMP_JRN_${reference}`,
      description: `Simulated ${cleanNetwork} airtime to ${phone}`,
      transactionId: txn.id,
      entries: [
        {
          accountNumber: `21000-${customerId}`,
          direction: EntryDirection.DEBIT,
          amountKobo,
        },
        {
          accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
          direction: EntryDirection.CREDIT,
          amountKobo: providerCostKobo,
        },
        {
          accountNumber: CHART_OF_ACCOUNTS.VAS_COMMISSION_REVENUE,
          direction: EntryDirection.CREDIT,
          amountKobo: commissionKobo,
        },
      ],
    });

    const newBalance = (await this.getBalance(customerId)).availableBalanceKobo;

    return {
      transactionId: txn.id,
      reference,
      type: 'AIRTIME',
      network: cleanNetwork,
      beneficiaryPhone: phone,
      packageDetails: `₦${Number(amountKobo) / 100} Airtime Top-Up`,
      amountDebitedKobo: amountKobo,
      newBalanceKobo: newBalance,
      status: 'SUCCESSFUL',
      isSimulated: true,
    };
  }

  /**
   * Simulates a data bundle purchase without calling external telcos.
   */
  async simulateDataPurchase(
    customerId: string,
    phone: string,
    network: string,
    planCode: string,
    amountKobo: bigint,
  ): Promise<MockVasResult> {
    if (amountKobo <= 0n) {
      throw new FinancialInvariantException('Data plan amount must be strictly positive.');
    }

    const currentBalance = (await this.getBalance(customerId)).availableBalanceKobo;
    if (currentBalance < amountKobo) {
      throw new InsufficientFundsException('Insufficient balance for data purchase.');
    }

    const cleanNetwork = network.toUpperCase();
    const reference = `MOCK_DAT_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const txn = await this.prisma.transaction.create({
      data: {
        internalReference: reference,
        idempotencyKey: `IDEMP_${reference}`,
        customerId,
        type: TransactionType.DATA_PURCHASE,
        state: TransactionState.SUCCESSFUL,
        amountKobo,
        feeKobo: 0n,
        currency: 'NGN',
        destinationAccountNumber: phone,
        recipientAlias: `${cleanNetwork} ${planCode} Data`,
        isSimulated: true,
      },
    });

    // Double-Entry Ledger
    const commissionKobo = (amountKobo * 3n) / 100n;
    const providerCostKobo = amountKobo - commissionKobo;

    await this.ledgerService.postJournal({
      reference: `JRN_${reference}`,
      idempotencyKey: `IDEMP_JRN_${reference}`,
      description: `Simulated ${cleanNetwork} ${planCode} data to ${phone}`,
      transactionId: txn.id,
      entries: [
        {
          accountNumber: `21000-${customerId}`,
          direction: EntryDirection.DEBIT,
          amountKobo,
        },
        {
          accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
          direction: EntryDirection.CREDIT,
          amountKobo: providerCostKobo,
        },
        {
          accountNumber: CHART_OF_ACCOUNTS.VAS_COMMISSION_REVENUE,
          direction: EntryDirection.CREDIT,
          amountKobo: commissionKobo,
        },
      ],
    });

    const newBalance = (await this.getBalance(customerId)).availableBalanceKobo;

    return {
      transactionId: txn.id,
      reference,
      type: 'DATA',
      network: cleanNetwork,
      beneficiaryPhone: phone,
      packageDetails: `${planCode} Data Bundle`,
      amountDebitedKobo: amountKobo,
      newBalanceKobo: newBalance,
      status: 'SUCCESSFUL',
      isSimulated: true,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. Simulated Gifting
  // ---------------------------------------------------------------------------

  /**
   * Simulates sending a gift (airtime, data, or cash) to another WhatsApp number.
   * Airtime and data earn VAS commission; cash is settled at face value.
   */
  async simulateGift(
    customerId: string,
    giftType: 'AIRTIME' | 'DATA' | 'CASH',
    recipientPhone: string,
    amountKobo: bigint,
    network?: string,
    planCode?: string,
    note?: string,
  ): Promise<MockGiftResult> {
    if (amountKobo <= 0n) {
      throw new FinancialInvariantException('Gift amount must be strictly positive.');
    }

    const cleanRecipient = recipientPhone.replace(/[\s+\-()]/g, '');
    if (!/^\d{10,15}$/.test(cleanRecipient)) {
      throw new BadRequestException('A valid recipient phone number is required.');
    }

    const currentBalance = (await this.getBalance(customerId)).availableBalanceKobo;
    if (currentBalance < amountKobo) {
      throw new InsufficientFundsException('Insufficient balance for gift.');
    }

    const cleanNetwork = network ? network.toUpperCase() : undefined;
    const reference = `MOCK_GFT_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const description =
      giftType === 'CASH'
        ? 'Cash Gift'
        : giftType === 'DATA'
          ? `${cleanNetwork} ${planCode} Data Gift`
          : `${cleanNetwork} Airtime Gift`;

    const txn = await this.prisma.transaction.create({
      data: {
        internalReference: reference,
        idempotencyKey: `IDEMP_${reference}`,
        customerId,
        type:
          giftType === 'CASH'
            ? TransactionType.TRANSFER
            : giftType === 'DATA'
              ? TransactionType.DATA_PURCHASE
              : TransactionType.AIRTIME_PURCHASE,
        state: TransactionState.SUCCESSFUL,
        amountKobo,
        feeKobo: 0n,
        currency: 'NGN',
        destinationAccountNumber: cleanRecipient,
        recipientAlias: note ? `Gift: ${note}` : description,
        isSimulated: true,
      },
    });

    const commissionKobo =
      giftType === 'AIRTIME'
        ? (amountKobo * 2n) / 100n
        : giftType === 'DATA'
          ? (amountKobo * 3n) / 100n
          : 0n;
    const providerCostKobo = amountKobo - commissionKobo;

    const entries: Array<{
      accountNumber: string;
      direction: EntryDirection;
      amountKobo: bigint;
    }> = [
      {
        accountNumber: `21000-${customerId}`,
        direction: EntryDirection.DEBIT,
        amountKobo,
      },
      {
        accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
        direction: EntryDirection.CREDIT,
        amountKobo: providerCostKobo,
      },
    ];

    if (commissionKobo > 0n) {
      entries.push({
        accountNumber: CHART_OF_ACCOUNTS.VAS_COMMISSION_REVENUE,
        direction: EntryDirection.CREDIT,
        amountKobo: commissionKobo,
      });
    }

    await this.ledgerService.postJournal({
      reference: `JRN_${reference}`,
      idempotencyKey: `IDEMP_JRN_${reference}`,
      description: `Simulated ${description} to ${cleanRecipient}`,
      transactionId: txn.id,
      entries,
    });

    const newBalance = (await this.getBalance(customerId)).availableBalanceKobo;

    return {
      transactionId: txn.id,
      reference,
      giftType,
      recipientPhone: cleanRecipient,
      amountDebitedKobo: amountKobo,
      newBalanceKobo: newBalance,
      network: cleanNetwork,
      plan: planCode,
      note,
      status: 'SUCCESSFUL',
      isSimulated: true,
    };
  }

  // ---------------------------------------------------------------------------
  // 9. Saved Recipients
  // ---------------------------------------------------------------------------

  /**
   * Returns list of saved recipients for a customer.
   */
  async listSavedRecipients(customerId: string): Promise<MockRecipientSummary[]> {
    const recipients = await this.recipientsService.getCustomerRecipients(customerId);

    return recipients.map((r) => ({
      id: r.id,
      accountName: r.accountName,
      accountNumber: r.accountNumber,
      bankName: r.bankName,
      bankCode: r.bankCode,
      aliases: (r.aliases || []).map((a) => a.alias),
    }));
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensures the customer's dedicated liability ledger account exists.
   */
  private async ensureCustomerAccount(
    customerId: string,
    fullName = 'Customer',
    starterBalanceKobo = MOCK_FINANCIAL_CONSTANTS.INITIAL_STARTER_BALANCE_KOBO,
  ) {
    const existing = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${customerId}` },
    });

    if (!existing) {
      await this.prisma.ledgerAccount.create({
        data: {
          accountNumber: `21000-${customerId}`,
          name: `Simulated Customer Deposit - ${fullName}`,
          type: LedgerAccountType.LIABILITY,
          customerId,
          balanceKobo: starterBalanceKobo,
        },
      });
    } else if (existing.balanceKobo === 0n && starterBalanceKobo > 0n) {
      await this.prisma.ledgerAccount.update({
        where: { id: existing.id },
        data: { balanceKobo: starterBalanceKobo },
      });
    }
  }
}
