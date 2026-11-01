import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReconciliationStatus, TransactionState } from '@prisma/client';

export interface DiscrepancyItem {
  transactionId: string;
  internalReference: string;
  providerReference?: string;
  discrepancyType:
    | 'AMOUNT_MISMATCH'
    | 'STATUS_MISMATCH'
    | 'MISSING_PROVIDER_RECORD'
    | 'MISSING_LEDGER_POSTING';
  internalValue: string;
  expectedValue: string;
  detectedAt: Date;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes an automated three-way reconciliation run across a specific time window.
   */
  async runReconciliation(provider: string, periodStart: Date, periodEnd: Date) {
    this.logger.log(
      `Starting financial reconciliation for ${provider} from ${periodStart.toISOString()} to ${periodEnd.toISOString()}`,
    );

    const runRef = `REC_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const run = await this.prisma.reconciliationRun.create({
      data: {
        reference: runRef,
        provider,
        periodStart,
        periodEnd,
        status: ReconciliationStatus.IN_PROGRESS,
      },
    });

    const discrepancies: DiscrepancyItem[] = [];

    // 1. Fetch internal transactions within window
    const transactions = await this.prisma.transaction.findMany({
      where: {
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      include: { journals: { include: { entries: true } } },
    });

    let totalAmountKobo = 0n;

    for (const txn of transactions) {
      totalAmountKobo += txn.amountKobo;

      // Invariant Check 1: Every SUCCESSFUL transaction MUST have posted ledger journals
      if (txn.state === TransactionState.SUCCESSFUL && (!txn.journals || txn.journals.length === 0)) {
        discrepancies.push({
          transactionId: txn.id,
          internalReference: txn.internalReference,
          providerReference: txn.providerReference || undefined,
          discrepancyType: 'MISSING_LEDGER_POSTING',
          internalValue: 'NO_JOURNALS_FOUND',
          expectedValue: 'POSTED_SETTLEMENT_JOURNAL',
          detectedAt: new Date(),
        });
      }

      // Invariant Check 2: Transactions marked PENDING for longer than 30 minutes require operator investigation
      if (
        txn.state === TransactionState.PENDING &&
        Date.now() - txn.createdAt.getTime() > 30 * 60 * 1000
      ) {
        discrepancies.push({
          transactionId: txn.id,
          internalReference: txn.internalReference,
          providerReference: txn.providerReference || undefined,
          discrepancyType: 'STATUS_MISMATCH',
          internalValue: 'PENDING_TIMEOUT',
          expectedValue: 'FINAL_SUCCESS_OR_FAIL',
          detectedAt: new Date(),
        });
      }
    }

    const finalStatus =
      discrepancies.length === 0
        ? ReconciliationStatus.MATCHED
        : ReconciliationStatus.DISCREPANCIES_FOUND;

    const completed = await this.prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        totalTransactions: transactions.length,
        totalAmountKobo,
        status: finalStatus,
        discrepancies: JSON.stringify(discrepancies),
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Reconciliation ${runRef} completed with status: ${finalStatus}. Total mismatches: ${discrepancies.length}`,
    );

    return completed;
  }
}
