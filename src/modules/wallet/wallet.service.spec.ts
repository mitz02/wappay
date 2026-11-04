import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let service: WalletService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      wallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new WalletService(mockPrisma);
  });

  describe('createWallet', () => {
    it('should create a new MOCK wallet with zero balance', async () => {
      const mockWallet = {
        id: 'wallet-1',
        customerId: 'cust-1',
        walletType: 'MOCK',
        currency: 'NGN',
        balanceKobo: BigInt(0),
        status: 'ACTIVE',
      };

      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.wallet.create.mockResolvedValue(mockWallet);

      const result = await service.createWallet('cust-1');

      expect(result.walletType).toBe('MOCK');
      expect(result.currency).toBe('NGN');
      expect(result.balanceKobo).toBe(BigInt(0));
      expect(result.status).toBe('ACTIVE');
      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: {
          customerId: 'cust-1',
          walletType: 'MOCK',
          currency: 'NGN',
          balanceKobo: BigInt(0),
          status: 'ACTIVE',
        },
      });
    });

    it('should return existing wallet if already created (idempotent)', async () => {
      const existingWallet = {
        id: 'wallet-1',
        customerId: 'cust-1',
        walletType: 'MOCK',
        balanceKobo: BigInt(500000),
      };

      mockPrisma.wallet.findUnique.mockResolvedValue(existingWallet);

      const result = await service.createWallet('cust-1');

      expect(result).toEqual(existingWallet);
      expect(mockPrisma.wallet.create).not.toHaveBeenCalled();
    });
  });

  describe('deposit', () => {
    it('should deposit funds atomically and record transaction', async () => {
      const wallet = {
        id: 'wallet-1',
        customerId: 'cust-1',
        balanceKobo: BigInt(0),
        status: 'ACTIVE',
      };

      const updatedWallet = { ...wallet, balanceKobo: BigInt(500000) };
      const transaction = {
        id: 'txn-1',
        reference: 'DEP_test_123',
        type: 'DEPOSIT',
        amountKobo: BigInt(500000),
        balanceAfterKobo: BigInt(500000),
        status: 'COMPLETED',
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          wallet: {
            findUnique: jest.fn().mockResolvedValue(wallet),
            update: jest.fn().mockResolvedValue(updatedWallet),
          },
          walletTransaction: {
            create: jest.fn().mockResolvedValue(transaction),
          },
        };
        return fn(tx);
      });

      const result = await service.deposit('cust-1', BigInt(500000));

      expect(result.transaction.reference).toMatch(/^DEP_/);
      expect(result.newBalanceKobo).toBe(BigInt(500000));
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should reject zero and negative amounts', async () => {
      await expect(service.deposit('cust-1', BigInt(0))).rejects.toThrow(
        'Deposit amount must be positive',
      );
      await expect(service.deposit('cust-1', BigInt(-100))).rejects.toThrow(
        'Deposit amount must be positive',
      );
    });

    it('should reject amounts exceeding testing limit', async () => {
      const tooMuch = BigInt(10_000_000_01); // ₦10,000,000.01
      await expect(service.deposit('cust-1', tooMuch)).rejects.toThrow(
        'exceeds the testing limit',
      );
    });

    it('should be idempotent with same idempotency key', async () => {
      const existingTxn = {
        id: 'txn-1',
        reference: 'DEP_test_123',
        idempotencyKey: 'idem-1',
        amountKobo: BigInt(500000),
      };
      const wallet = { id: 'wallet-1', customerId: 'cust-1', balanceKobo: BigInt(500000) };

      mockPrisma.walletTransaction.findUnique.mockResolvedValue(existingTxn);
      mockPrisma.wallet.findUnique.mockResolvedValue(wallet);

      const result = await service.deposit('cust-1', BigInt(500000), 'idem-1');

      expect(result.transaction).toEqual(existingTxn);
      expect(result.newBalanceKobo).toBe(BigInt(500000));
      // Should not call $transaction for idempotent replay
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getBalanceKobo', () => {
    it('should return wallet balance', async () => {
      const wallet = { id: 'w1', customerId: 'c1', balanceKobo: BigInt(750000) };
      mockPrisma.wallet.findUnique.mockResolvedValue(wallet);

      const balance = await service.getBalanceKobo('c1');
      expect(balance).toBe(BigInt(750000));
    });

    it('should throw if wallet not found', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.getBalanceKobo('c1')).rejects.toThrow('Wallet not found');
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const wallet = { id: 'w1', customerId: 'c1' };
      const transactions = [
        { id: 't1', reference: 'DEP_1', type: 'DEPOSIT', amountKobo: BigInt(100000) },
        { id: 't2', reference: 'DEP_2', type: 'DEPOSIT', amountKobo: BigInt(200000) },
      ];

      mockPrisma.wallet.findUnique.mockResolvedValue(wallet);
      mockPrisma.walletTransaction.findMany.mockResolvedValue(transactions);
      mockPrisma.walletTransaction.count.mockResolvedValue(2);

      const result = await service.getTransactions('c1', 1, 10);

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
