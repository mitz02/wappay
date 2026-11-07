import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { CHART_OF_ACCOUNTS } from '../../common/constants';
import { MOCK_FINANCIAL_CONSTANTS } from '../mock-financial/mock-financial.constants';
import {
  Wallet,
  WalletTransaction,
  WalletTransactionType,
  WalletTransactionStatus,
  Prisma,
  EntryDirection,
  LedgerAccountType,
  TransactionType,
  TransactionState,
} from '@prisma/client';
import { randomBytes } from 'crypto';

export interface WalletDepositResult {
  transaction: WalletTransaction;
  newBalanceKobo: bigint;
}

/**
 * Wallet balance is a materialized mirror of the customer's ledger account
 * (21000-<customerId>). The ledger is the single source of truth: every read
 * re-syncs the mirror, and every deposit posts a double-entry journal before
 * the wallet row is updated.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createWallet(customerId: string): Promise<Wallet> {
    const existing = await this.prisma.wallet.findUnique({ where: { customerId } });
    if (existing) {
      this.logger.log(`Wallet already exists for customer ${customerId}, returning existing`);
      return existing;
    }

    const wallet = await this.prisma.wallet.create({
      data: {
        customerId,
        walletType: 'MOCK',
        currency: 'NGN',
        balanceKobo: BigInt(0),
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Mock wallet created: ${wallet.id} for customer ${customerId}`);
    return wallet;
  }

  async getWalletByCustomerId(customerId: string): Promise<Wallet | null> {
    const wallet = await this.prisma.wallet.findUnique({ where: { customerId } });
    if (!wallet) return null;
    return this.syncWalletBalance(wallet);
  }

  async getWalletOrThrow(customerId: string): Promise<Wallet> {
    const wallet = await this.getWalletByCustomerId(customerId);
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getBalanceKobo(customerId: string): Promise<bigint> {
    const wallet = await this.getWalletOrThrow(customerId);
    return wallet.balanceKobo;
  }

  async deposit(
    customerId: string,
    amountKobo: bigint,
    idempotencyKey?: string,
  ): Promise<WalletDepositResult> {
    if (amountKobo <= BigInt(0)) {
      throw new BadRequestException('Deposit amount must be positive');
    }

    const MAX_DEPOSIT_KOBO = BigInt(10_000_000_00); // ₦10,000,000 testing limit
    if (amountKobo > MAX_DEPOSIT_KOBO) {
      throw new BadRequestException('Amount exceeds the testing limit of ₦10,000,000');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.walletTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        this.logger.log(`Idempotent deposit replay for key ${idempotencyKey}`);
        const wallet = await this.getWalletOrThrow(customerId);
        return { transaction: existing, newBalanceKobo: wallet.balanceKobo };
      }
    }

    // A deterministic reference (derived from the idempotency key) makes every
    // crash-retry converge on the same journal, history row and wallet entry.
    const reference = idempotencyKey
      ? `DEP_${idempotencyKey.replace(/[^A-Za-z0-9]/g, '')}`
      : this.generateReference('DEP');

    let wallet = await this.prisma.wallet.findUnique({ where: { customerId } });
    if (!wallet) {
      wallet = await this.createWallet(customerId);
    }
    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestException('Wallet is not active');
    }

    await this.ensureLedgerAccount(customerId);
    await this.ensureSystemAccounts();

    await this.ledgerService.postJournal({
      reference: `JRN_${reference}`,
      idempotencyKey: `IDEMP_JRN_${reference}`,
      description: 'Simulated test deposit',
      entries: [
        {
          accountNumber: CHART_OF_ACCOUNTS.PARTNER_SETTLEMENT_ESCROW,
          direction: EntryDirection.DEBIT,
          amountKobo,
          description: 'Deposit funding (simulated)',
        },
        {
          accountNumber: this.customerAccountNumber(customerId),
          direction: EntryDirection.CREDIT,
          amountKobo,
          description: 'Customer deposit credit',
        },
      ],
    });

    const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: this.customerAccountNumber(customerId) },
    });
    const newBalance = ledgerAccount?.balanceKobo ?? wallet.balanceKobo;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet!.id },
          data: { balanceKobo: newBalance },
        });

        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet!.id,
            reference,
            idempotencyKey: idempotencyKey || null,
            type: 'DEPOSIT',
            amountKobo,
            balanceAfterKobo: newBalance,
            status: 'COMPLETED',
            description: 'Simulated test deposit',
            metadata: JSON.stringify({ simulated: true, walletType: 'MOCK' }),
          },
        });

        // Mirror into the shared transaction history so chat `history` shows it.
        await tx.transaction.upsert({
          where: { internalReference: reference },
          update: {},
          create: {
            internalReference: reference,
            idempotencyKey: `IDEMP_${reference}`,
            customerId,
            type: TransactionType.DEPOSIT,
            state: TransactionState.SUCCESSFUL,
            amountKobo,
            feeKobo: BigInt(0),
            currency: 'NGN',
            recipientAlias: 'Wallet Deposit',
            isSimulated: true,
          },
        });

        return { transaction, newBalanceKobo: updatedWallet.balanceKobo };
      });

      this.logger.log(
        `Deposit completed: ${reference} | ₦${Number(amountKobo) / 100} | new balance ₦${Number(result.newBalanceKobo) / 100}`,
      );
      return result;
    } catch (err: any) {
      if (err.code === 'P2002' && err.meta?.target?.includes('idempotencyKey')) {
        const existing = await this.prisma.walletTransaction.findUnique({
          where: { idempotencyKey: idempotencyKey! },
        });
        const walletAfter = await this.getWalletOrThrow(customerId);
        if (existing) return { transaction: existing, newBalanceKobo: walletAfter.balanceKobo };
      }
      throw err;
    }
  }

  async getTransactions(
    customerId: string,
    page = 1,
    pageSize = 10,
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const wallet = await this.getWalletOrThrow(customerId);
    const skip = (page - 1) * pageSize;

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return { transactions, total };
  }

  async getTransactionByReference(
    customerId: string,
    reference: string,
  ): Promise<WalletTransaction | null> {
    const wallet = await this.getWalletByCustomerId(customerId);
    if (!wallet) return null;
    return this.prisma.walletTransaction.findFirst({
      where: { walletId: wallet.id, reference },
    });
  }

  // ---------------------------------------------------------------------------
  // Ledger-backed balance helpers
  // ---------------------------------------------------------------------------

  private customerAccountNumber(customerId: string): string {
    return `21000-${customerId}`;
  }

  /**
   * Ensures the customer's liability ledger account exists (created with the
   * standard mock starter balance) and returns it.
   */
  private async ensureLedgerAccount(customerId: string) {
    const accountNumber = this.customerAccountNumber(customerId);
    const existing = await this.prisma.ledgerAccount.findUnique({ where: { accountNumber } });
    if (existing) return existing;

    try {
      return await this.prisma.ledgerAccount.create({
        data: {
          accountNumber,
          name: `Customer Deposit Liability - ${customerId}`,
          type: LedgerAccountType.LIABILITY,
          customerId,
          balanceKobo: MOCK_FINANCIAL_CONSTANTS.INITIAL_STARTER_BALANCE_KOBO,
        },
      });
    } catch (err: any) {
      if (err.code !== 'P2002') throw err; // concurrent create — fall through to re-read
      return this.prisma.ledgerAccount.findUnique({ where: { accountNumber } });
    }
  }

  /**
   * Makes sure the system escrow account exists so deposit journals can post
   * even when the database was never seeded.
   */
  private async ensureSystemAccounts(): Promise<void> {
    const escrow = await this.prisma.ledgerAccount.findUnique({
      where: { accountNumber: CHART_OF_ACCOUNTS.PARTNER_SETTLEMENT_ESCROW },
    });
    if (!escrow) {
      await this.ledgerService.initializeChartOfAccounts();
    }
  }

  /**
   * Re-syncs the wallet mirror from the ledger so all chat surfaces (my wallet,
   * deposit screen, account info, balance command) show the same number.
   */
  private async syncWalletBalance(wallet: Wallet): Promise<Wallet> {
    try {
      const ledgerAccount = await this.ensureLedgerAccount(wallet.customerId);
      if (!ledgerAccount || ledgerAccount.balanceKobo === wallet.balanceKobo) {
        return wallet;
      }
      return await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceKobo: ledgerAccount.balanceKobo },
      });
    } catch (err: any) {
      this.logger.warn(`Could not sync wallet balance for ${wallet.customerId}: ${err.message}`);
      return wallet;
    }
  }

  private generateReference(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }
}
