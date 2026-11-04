import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  Wallet,
  WalletTransaction,
  WalletTransactionType,
  WalletTransactionStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';

export interface WalletDepositResult {
  transaction: WalletTransaction;
  newBalanceKobo: bigint;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.wallet.findUnique({ where: { customerId } });
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

    const reference = this.generateReference('DEP');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { customerId } });
        if (!wallet) throw new NotFoundException('Wallet not found');
        if (wallet.status !== 'ACTIVE') throw new BadRequestException('Wallet is not active');

        const newBalance = wallet.balanceKobo + amountKobo;

        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceKobo: newBalance },
        });

        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
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
        const wallet = await this.getWalletOrThrow(customerId);
        if (existing) return { transaction: existing, newBalanceKobo: wallet.balanceKobo };
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

  private generateReference(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }
}
