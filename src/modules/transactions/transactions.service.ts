import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { RecipientsService } from '../recipients/recipients.service';
import { AuthService } from '../authentication/auth.service';
import {
  IFinancialProvider,
} from '../../contracts/financial/financial-provider.contract';
import {
  CreateTransferRequestDto,
  AuthorizeTransferDto,
  TransactionPreviewDto,
} from './dto/initiate-transfer.dto';
import {
  TransactionStateMachine,
} from './state-machine/transaction-state-machine';
import {
  TransactionState,
  TransactionType,
  EntryDirection,
} from '@prisma/client';
import { CHART_OF_ACCOUNTS, LIMITS } from '../../common/constants';
import {
  FinancialInvariantException,
  InsufficientFundsException,
  UnauthorizedTransactionException,
  IdempotencyConflictException,
} from '../../common/exceptions';
import * as crypto from 'crypto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly recipientsService: RecipientsService,
    private readonly authService: AuthService,
    @Inject('FINANCIAL_PROVIDER')
    private readonly provider: IFinancialProvider,
  ) {}

  /**
   * Phase 1: Validates transfer parameters, resolves recipient, and issues authorization challenge.
   */
  async createTransferIntent(dto: CreateTransferRequestDto): Promise<TransactionPreviewDto> {
    if (dto.amountKobo <= 0n) {
      throw new FinancialInvariantException('Transfer amount must be strictly positive.');
    }

    // Check Idempotency
    const existing = await this.prisma.transaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { authorizations: true },
    });

    if (existing) {
      if (existing.state !== TransactionState.AWAITING_AUTHORIZATION) {
        throw new IdempotencyConflictException();
      }
      const auth = existing.authorizations.find((a) => !a.isUsed && a.expiresAt > new Date());
      if (auth) {
        return {
          transactionId: existing.id,
          amountKobo: existing.amountKobo,
          feeKobo: existing.feeKobo,
          totalKobo: existing.amountKobo + existing.feeKobo,
          currency: existing.currency,
          recipientName: existing.destinationAccountName || '',
          recipientAccountNumber: existing.destinationAccountNumber || '',
          recipientBankName: existing.recipientAlias || '',
          challengeToken: auth.challengeToken,
          expiresInMinutes: LIMITS.AUTHORIZATION_EXPIRATION_MINUTES,
        };
      }
    }

    // 1. Resolve Customer & Check Limits
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found.`);
    }

    const feeKobo = LIMITS.DEFAULT_TRANSFER_FEE_KOBO;
    const totalRequiredKobo = dto.amountKobo + feeKobo;

    if (dto.amountKobo > customer.dailyLimitKobo) {
      throw new BadRequestException(
        `Transfer amount exceeds your current KYC daily limit of ₦${Number(customer.dailyLimitKobo) / 100}`,
      );
    }

    // 2. Resolve Destination Recipient
    const recipient = await this.recipientsService.resolveRecipient(
      dto.customerId,
      dto.recipientAliasOrName,
    );

    // 3. Check Available Customer Balance
    const customerAccount = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: `21000-${dto.customerId}` },
    });

    const currentBalance = customerAccount?.balanceKobo || 0n;
    if (currentBalance < totalRequiredKobo) {
      throw new InsufficientFundsException(
        `Insufficient available funds. Required: ₦${Number(totalRequiredKobo) / 100}, Available: ₦${Number(currentBalance) / 100}`,
      );
    }

    // 4. Generate Challenge and Transaction Record
    const internalReference = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const challengeToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + LIMITS.AUTHORIZATION_EXPIRATION_MINUTES * 60 * 1000);

    const transaction = await this.prisma.$transaction(async (tx) => {
      const createdTxn = await tx.transaction.create({
        data: {
          internalReference,
          idempotencyKey: dto.idempotencyKey,
          customerId: dto.customerId,
          type: TransactionType.TRANSFER,
          state: TransactionState.AWAITING_AUTHORIZATION,
          amountKobo: dto.amountKobo,
          feeKobo,
          currency: 'NGN',
          destinationAccountNumber: recipient.accountNumber,
          destinationBankCode: recipient.bankCode,
          destinationAccountName: recipient.accountName,
          recipientAlias: dto.recipientAliasOrName,
          isSimulated: this.provider.isSandbox,
        },
      });

      await tx.transactionEvent.create({
        data: {
          transactionId: createdTxn.id,
          fromState: TransactionState.CREATED,
          toState: TransactionState.AWAITING_AUTHORIZATION,
          reason: 'Intent validated and authorization preview generated',
        },
      });

      await tx.transactionAuthorization.create({
        data: {
          transactionId: createdTxn.id,
          challengeToken,
          expiresAt,
        },
      });

      return createdTxn;
    });

    return {
      transactionId: transaction.id,
      amountKobo: dto.amountKobo,
      feeKobo,
      totalKobo: totalRequiredKobo,
      currency: 'NGN',
      recipientName: recipient.accountName,
      recipientAccountNumber: recipient.accountNumber,
      recipientBankName: recipient.bankName,
      challengeToken,
      expiresInMinutes: LIMITS.AUTHORIZATION_EXPIRATION_MINUTES,
    };
  }

  /**
   * Phase 2: Authorizes with Customer PIN, reserves funds, and executes payout via Financial Provider.
   */
  async authorizeAndExecuteTransfer(dto: AuthorizeTransferDto) {
    const txn = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: { authorizations: true, customer: true },
    });

    if (!txn) {
      throw new NotFoundException(`Transaction ${dto.transactionId} not found.`);
    }

    TransactionStateMachine.validateTransition(txn.state, TransactionState.AUTHORIZED);

    // 1. Verify Challenge Token
    const authRecord = txn.authorizations.find(
      (a) => a.challengeToken === dto.challengeToken && !a.isUsed,
    );

    if (!authRecord) {
      throw new UnauthorizedTransactionException('Authorization challenge not found or already used.');
    }

    if (authRecord.expiresAt < new Date()) {
      await this.transitionState(txn.id, txn.state, TransactionState.CANCELLED, 'Authorization token expired');
      throw new UnauthorizedTransactionException('Authorization token has expired. Please restart the request.');
    }

    // 2. Verify Customer PIN (Argon2id)
    const pinVerification = await this.authService.verifyCustomerPin(dto.customerId, dto.pin);
    if (!pinVerification.success) {
      throw new UnauthorizedTransactionException(pinVerification.error);
    }

    // Mark challenge as used
    await this.prisma.transactionAuthorization.update({
      where: { id: authRecord.id },
      data: { isUsed: true, authorizedAt: new Date() },
    });

    // 3. Transition to AUTHORIZED
    await this.transitionState(txn.id, txn.state, TransactionState.AUTHORIZED, 'Customer PIN verified');

    // 4. Reserve Funds in Double-Entry Ledger (Customer Deposit -> Customer Reserved)
    const totalDeductionKobo = txn.amountKobo + txn.feeKobo;
    const customerAccountNum = `21000-${txn.customerId}`;

    const reservationJournalRef = `JRN_RES_${txn.internalReference}`;
    await this.ledgerService.postJournal({
      reference: reservationJournalRef,
      idempotencyKey: `IDEMP_RES_${txn.internalReference}`,
      description: `Reserve funds for transfer ${txn.internalReference}`,
      transactionId: txn.id,
      entries: [
        {
          accountNumber: customerAccountNum,
          direction: EntryDirection.DEBIT, // Debit liability decreases customer balance
          amountKobo: totalDeductionKobo,
        },
        {
          accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_RESERVED,
          direction: EntryDirection.CREDIT, // Credit liability holds reserved funds
          amountKobo: totalDeductionKobo,
        },
      ],
    });

    // 5. Transition to PROCESSING
    await this.transitionState(txn.id, TransactionState.AUTHORIZED, TransactionState.PROCESSING, 'Funds reserved; dispatching to provider');

    // 6. Dispatch to Financial Provider
    try {
      const providerResponse = await this.provider.initiateTransfer({
        internalReference: txn.internalReference,
        idempotencyKey: `IDEMP_PRV_${txn.internalReference}`,
        amountKobo: txn.amountKobo,
        currency: txn.currency,
        destinationAccountNumber: txn.destinationAccountNumber!,
        destinationBankCode: txn.destinationBankCode!,
        destinationAccountName: txn.destinationAccountName!,
        narration: `WAPPay Transfer: ${txn.internalReference}`,
      });

      await this.prisma.transaction.update({
        where: { id: txn.id },
        data: { providerReference: providerResponse.providerReference },
      });

      if (providerResponse.status === 'SUCCESS') {
        // Complete settlement in ledger
        const settlementJournalRef = `JRN_SET_${txn.internalReference}`;
        await this.ledgerService.postJournal({
          reference: settlementJournalRef,
          idempotencyKey: `IDEMP_SET_${txn.internalReference}`,
          description: `Settlement payout for transfer ${txn.internalReference}`,
          transactionId: txn.id,
          entries: [
            {
              accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_RESERVED,
              direction: EntryDirection.DEBIT,
              amountKobo: totalDeductionKobo,
            },
            {
              accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
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

        await this.transitionState(txn.id, TransactionState.PROCESSING, TransactionState.SUCCESSFUL, providerResponse.message);
        return {
          status: 'SUCCESSFUL',
          transactionId: txn.id,
          reference: txn.internalReference,
          providerReference: providerResponse.providerReference,
          message: 'Transfer completed successfully.',
        };
      } else if (providerResponse.status === 'PENDING') {
        // Leave funds in RESERVED pool until asynchronous webhook confirms settlement
        await this.transitionState(txn.id, TransactionState.PROCESSING, TransactionState.PENDING, providerResponse.message);
        return {
          status: 'PENDING',
          transactionId: txn.id,
          reference: txn.internalReference,
          message: 'Transfer submitted to clearing network. We will notify you once confirmed.',
        };
      } else {
        // Provider synchronously rejected payout: rollback reservation back to customer deposit
        await this.rollbackReservation(txn.id, customerAccountNum, totalDeductionKobo, txn.internalReference);
        await this.transitionState(txn.id, TransactionState.PROCESSING, TransactionState.FAILED, providerResponse.message);
        return {
          status: 'FAILED',
          transactionId: txn.id,
          reference: txn.internalReference,
          message: providerResponse.message,
        };
      }
    } catch (err: any) {
      this.logger.error(`Provider network exception for ${txn.internalReference}: ${err.message}`);
      // RULE: Network timeouts must NEVER be marked as FAILED automatically!
      await this.transitionState(
        txn.id,
        TransactionState.PROCESSING,
        TransactionState.PENDING,
        `Uncertain provider response: ${err.message}. Awaiting reconciliation/webhook.`,
      );
      return {
        status: 'PENDING',
        transactionId: txn.id,
        reference: txn.internalReference,
        message: 'Transaction submitted but awaiting provider confirmation.',
      };
    }
  }

  /**
   * Safe rollback of reserved funds back to customer deposit on synchronous rejection.
   */
  private async rollbackReservation(
    transactionId: string,
    customerAccountNum: string,
    totalDeductionKobo: bigint,
    ref: string,
  ) {
    await this.ledgerService.postJournal({
      reference: `JRN_ROLLBACK_${ref}`,
      idempotencyKey: `IDEMP_ROLLBACK_${ref}`,
      description: `Rollback reserved funds for rejected transfer ${ref}`,
      transactionId,
      entries: [
        {
          accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_RESERVED,
          direction: EntryDirection.DEBIT,
          amountKobo: totalDeductionKobo,
        },
        {
          accountNumber: customerAccountNum,
          direction: EntryDirection.CREDIT,
          amountKobo: totalDeductionKobo,
        },
      ],
    });
  }

  /**
   * Enforces valid state machine transition and records immutable audit timeline event.
   */
  private async transitionState(
    transactionId: string,
    from: TransactionState,
    to: TransactionState,
    reason?: string,
  ) {
    TransactionStateMachine.validateTransition(from, to);

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { state: to, failureReason: to === TransactionState.FAILED ? reason : undefined },
      });

      await tx.transactionEvent.create({
        data: {
          transactionId,
          fromState: from,
          toState: to,
          reason,
        },
      });
    });
  }
}
