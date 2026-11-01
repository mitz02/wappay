import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PostJournalDto, ReverseJournalDto } from './dto/post-journal.dto';
import { FinancialInvariantException } from '../../common/exceptions';
import { EntryDirection, JournalStatus, LedgerAccountType } from '@prisma/client';
import { CHART_OF_ACCOUNTS } from '../../common/constants';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes standard Chart of Accounts if they do not yet exist.
   */
  async initializeChartOfAccounts(): Promise<void> {
    const defaultAccounts = [
      { accountNumber: CHART_OF_ACCOUNTS.PARTNER_SETTLEMENT_ESCROW, name: 'Partner Settlement Escrow', type: LedgerAccountType.ASSET },
      { accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING, name: 'Provider Clearing Account', type: LedgerAccountType.ASSET },
      { accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_DEPOSITS, name: 'Customer Stored Deposits Pool', type: LedgerAccountType.LIABILITY },
      { accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_RESERVED, name: 'Customer Reserved Funds Pool', type: LedgerAccountType.LIABILITY },
      { accountNumber: CHART_OF_ACCOUNTS.SUSPENSE, name: 'General Suspense Account', type: LedgerAccountType.LIABILITY },
      { accountNumber: CHART_OF_ACCOUNTS.RETAINED_RESERVES, name: 'Platform Retained Reserves', type: LedgerAccountType.EQUITY },
      { accountNumber: CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE, name: 'Transaction Fee Revenue', type: LedgerAccountType.REVENUE },
      { accountNumber: CHART_OF_ACCOUNTS.VAS_COMMISSION_REVENUE, name: 'Airtime/Data Commission Revenue', type: LedgerAccountType.REVENUE },
      { accountNumber: CHART_OF_ACCOUNTS.PROVIDER_COSTS, name: 'Provider Interchange & Transfer Costs', type: LedgerAccountType.EXPENSE },
    ];

    for (const acc of defaultAccounts) {
      await this.prisma.ledgerAccount.upsert({
        where: { accountNumber: acc.accountNumber },
        update: {},
        create: {
          accountNumber: acc.accountNumber,
          name: acc.name,
          type: acc.type,
          isSystemAccount: true,
          balanceKobo: 0n,
        },
      });
    }
  }

  /**
   * Posts an immutable double-entry journal within an atomic transaction.
   * Enforces the Zero-Sum Invariant: sum(Debits) === sum(Credits).
   */
  async postJournal(dto: PostJournalDto) {
    if (!dto.entries || dto.entries.length < 2) {
      throw new FinancialInvariantException('A journal must contain at least two entries.');
    }

    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const entry of dto.entries) {
      if (entry.amountKobo <= 0n) {
        throw new FinancialInvariantException(
          `Entry amount must be strictly positive. Received ${entry.amountKobo} for account ${entry.accountNumber}`,
        );
      }

      if (entry.direction === EntryDirection.DEBIT) {
        totalDebits += entry.amountKobo;
      } else if (entry.direction === EntryDirection.CREDIT) {
        totalCredits += entry.amountKobo;
      } else {
        throw new FinancialInvariantException(`Invalid entry direction: ${entry.direction}`);
      }
    }

    // BANK INVARIANT: Total Debits must exactly equal Total Credits
    if (totalDebits !== totalCredits) {
      throw new FinancialInvariantException(
        `Journal unbalanced. Total debits (${totalDebits} Kobo) != Total credits (${totalCredits} Kobo). Imbalance: ${totalDebits - totalCredits} Kobo`,
      );
    }

    // Check Idempotency
    const existingJournal = await this.prisma.ledgerJournal.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { entries: true },
    });

    if (existingJournal) {
      this.logger.warn(`Idempotent journal replay detected for key: ${dto.idempotencyKey}`);
      return existingJournal;
    }

    // Execute atomic posting and balance adjustments
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create the Journal Header
      const journal = await tx.ledgerJournal.create({
        data: {
          reference: dto.reference,
          description: dto.description,
          idempotencyKey: dto.idempotencyKey,
          transactionId: dto.transactionId,
          status: JournalStatus.POSTED,
          postedAt: dto.postedAt || new Date(),
        },
      });

      // 2. Process each entry and update materialized balances
      for (const item of dto.entries) {
        const account = await tx.ledgerAccount.findUnique({
          where: { accountNumber: item.accountNumber },
        });

        if (!account) {
          throw new FinancialInvariantException(`Ledger account not found: ${item.accountNumber}`);
        }

        // Calculate signed delta according to Account Type and Entry Direction
        let balanceDelta = 0n;
        const isAssetOrExpense =
          account.type === LedgerAccountType.ASSET || account.type === LedgerAccountType.EXPENSE;

        if (isAssetOrExpense) {
          balanceDelta = item.direction === EntryDirection.DEBIT ? item.amountKobo : -item.amountKobo;
        } else {
          // Liability, Equity, Revenue
          balanceDelta = item.direction === EntryDirection.CREDIT ? item.amountKobo : -item.amountKobo;
        }

        const newBalance = account.balanceKobo + balanceDelta;

        // Prevent customer liability accounts (deposits) from dipping below zero
        if (account.accountNumber.startsWith('21000') && newBalance < 0n) {
          throw new FinancialInvariantException(
            `Insufficient available balance in account ${account.accountNumber}. Available: ${account.balanceKobo} Kobo, Attempted debit: ${item.amountKobo} Kobo`,
          );
        }

        // Update Account Balance
        await tx.ledgerAccount.update({
          where: { id: account.id },
          data: { balanceKobo: newBalance },
        });

        // Record immutable LedgerEntry snapshot
        await tx.ledgerEntry.create({
          data: {
            journalId: journal.id,
            accountId: account.id,
            direction: item.direction,
            amountKobo: item.amountKobo,
            balanceAfterKobo: newBalance,
          },
        });
      }

      this.logger.log(`Journal successfully posted: ${journal.reference} (Amount: ${totalDebits} Kobo)`);
      return journal;
    });
  }

  /**
   * Reverses an existing journal by posting compensating inverse entries.
   * Never modifies or deletes the original journal record.
   */
  async reverseJournal(dto: ReverseJournalDto) {
    const original = await this.prisma.ledgerJournal.findUnique({
      where: { reference: dto.originalJournalReference },
      include: { entries: { include: { account: true } } },
    });

    if (!original) {
      throw new FinancialInvariantException(
        `Original journal for reversal not found: ${dto.originalJournalReference}`,
      );
    }

    if (original.status === JournalStatus.REVERSED) {
      throw new FinancialInvariantException(
        `Journal ${dto.originalJournalReference} has already been reversed.`,
      );
    }

    // Invert the directions
    const inverseEntries = original.entries.map((entry) => ({
      accountNumber: entry.account.accountNumber,
      direction: entry.direction === EntryDirection.DEBIT ? EntryDirection.CREDIT : EntryDirection.DEBIT,
      amountKobo: entry.amountKobo,
      description: `Reversal of entry in ${original.reference}`,
    }));

    return await this.prisma.$transaction(async (tx) => {
      // Mark original as REVERSED
      await tx.ledgerJournal.update({
        where: { id: original.id },
        data: { status: JournalStatus.REVERSED },
      });

      // Post the Reversal Journal
      return await this.postJournal({
        reference: dto.reversalReference,
        idempotencyKey: dto.idempotencyKey,
        description: `REVERSAL: ${dto.reason} (Ref: ${original.reference})`,
        transactionId: original.transactionId ?? undefined,
        entries: inverseEntries,
      });
    });
  }

  /**
   * Independently audits the ledger to verify that total system debits equals total system credits.
   */
  async verifySystemLedgerInvariants(): Promise<{
    isBalanced: boolean;
    totalDebitsKobo: bigint;
    totalCreditsKobo: bigint;
    discrepancyKobo: bigint;
  }> {
    const entries = await this.prisma.ledgerEntry.findMany({
      select: { direction: true, amountKobo: true },
    });

    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const e of entries) {
      if (e.direction === EntryDirection.DEBIT) {
        totalDebits += e.amountKobo;
      } else {
        totalCredits += e.amountKobo;
      }
    }

    const discrepancy = totalDebits - totalCredits;

    return {
      isBalanced: discrepancy === 0n,
      totalDebitsKobo: totalDebits,
      totalCreditsKobo: totalCredits,
      discrepancyKobo: discrepancy,
    };
  }
}
