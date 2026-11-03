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
} from '../mock-financial.constants';
import {
  MockAccountBalance,
  MockTransactionSummary,
  MockTransferPreview,
  MockTransferExecutionResult,
  MockDepositResult,
  MockWithdrawalResult,
  MockVasResult,
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

    const account = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${customerId}` },
    });

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

    // Resolve Recipient (saved alias/recipient or another mock customer)
    let recipientInfo: {
      accountNumber: string;
      accountName: string;
      bankCode: string;
      bankName: string;
      alias: string;
    } = {
      accountNumber: '',
      accountName: '',
      bankCode: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_CODE,
      bankName: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_NAME,
      alias: recipientAliasOrAccount,
    };

    try {
      const resolved = await this.recipientsService.resolveRecipient(
        senderCustomerId,
        recipientAliasOrAccount,
      );
      recipientInfo = {
        accountNumber: resolved.accountNumber,
        accountName: resolved.accountName,
        bankCode: resolved.bankCode,
        bankName: resolved.bankName,
        alias: recipientAliasOrAccount,
      };
    } catch {
      // Check if recipient is another mock customer by virtual account or phone
      const cleanTarget = recipientAliasOrAccount.replace(/[^0-9]/g, '');
      const otherCustomer = await this.prisma.customerProfile.findFirst({
        where: {
          OR: [
            { whatsappNumber: cleanTarget },
            { accountReference: cleanTarget },
          ],
        },
      });

      if (otherCustomer) {
        recipientInfo = {
          accountNumber: otherCustomer.accountReference || `01${otherCustomer.whatsappNumber.slice(-8)}`,
          accountName: otherCustomer.fullName,
          bankCode: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_CODE,
          bankName: MOCK_FINANCIAL_CONSTANTS.SIMULATED_BANK_NAME,
          alias: otherCustomer.fullName,
        };
      } else {
        // Fallback default mock recipient (never reuse a real virtual account)
        recipientInfo = {
          accountNumber: '9999999999',
          accountName: recipientAliasOrAccount.toUpperCase(),
          bankCode: '058',
          bankName: 'Guaranty Trust Bank (Simulated)',
          alias: recipientAliasOrAccount,
        };
      }
    }

    // Prevent self-transfer
    const senderVirtualAccount = sender.accountReference || `01${sender.whatsappNumber.slice(-8)}`;
    if (recipientInfo.accountNumber === senderVirtualAccount) {
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
   * Phase 2: Authorizes and atomically executes a pending transfer upon explicit confirmation.
   */
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

    // Find active pending transaction for this customer
    const txn = await this.prisma.transaction.findFirst({
      where: {
        customerId: senderCustomerId,
        state: TransactionState.AWAITING_AUTHORIZATION,
      },
      include: { authorizations: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!txn) {
      throw new NotFoundException('No pending transfer found awaiting confirmation.');
    }

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

    return {
      transactionId: txn.id,
      internalReference: txn.internalReference,
      amountKobo: txn.amountKobo,
      feeKobo: txn.feeKobo,
      totalDebitedKobo: totalRequiredKobo,
      recipientName: txn.destinationAccountName || 'Beneficiary',
      recipientAccountNumber: txn.destinationAccountNumber || '',
      recipientBankName: MOCK_BANKS[txn.destinationBankCode || '999'] || 'Commercial Bank',
      newBalanceKobo: updatedBalance,
      status: 'SUCCESSFUL',
      settlementMessage: 'Transfer simulated successfully on internal mock rails.',
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
  // 8. Saved Recipients
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
  private async ensureCustomerAccount(customerId: string, fullName = 'Customer') {
    await this.prisma.ledgerAccount.upsert({
      where: { accountNumber: `21000-${customerId}` },
      update: {},
      create: {
        accountNumber: `21000-${customerId}`,
        name: `Simulated Customer Deposit - ${fullName}`,
        type: LedgerAccountType.LIABILITY,
        customerId,
        balanceKobo: 0n,
      },
    });
  }
}
