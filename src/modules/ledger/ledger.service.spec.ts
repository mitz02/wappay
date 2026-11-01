import { LedgerService } from './ledger.service';
import { FinancialInvariantException } from '../../common/exceptions';
import { EntryDirection, LedgerAccountType, JournalStatus } from '@prisma/client';
import { CHART_OF_ACCOUNTS } from '../../common/constants';

describe('LedgerService (Bank-Grade Invariant Verification)', () => {
  let service: LedgerService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      ledgerAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      ledgerJournal: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    service = new LedgerService(mockPrisma);
  });

  describe('Mathematical Invariant Checks', () => {
    it('should reject a journal where Total Debits != Total Credits', async () => {
      const unbalancedDto = {
        reference: 'JRN_TEST_001',
        idempotencyKey: 'IDEMP_001',
        description: 'Unbalanced transfer test',
        entries: [
          {
            accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_DEPOSITS,
            direction: EntryDirection.DEBIT,
            amountKobo: 500000n, // 5,000 NGN
          },
          {
            accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
            direction: EntryDirection.CREDIT,
            amountKobo: 400000n, // 4,000 NGN -> Unbalanced!
          },
        ],
      };

      await expect(service.postJournal(unbalancedDto)).rejects.toThrow(
        FinancialInvariantException,
      );
    });

    it('should reject a journal with zero or negative amounts', async () => {
      const negativeAmountDto = {
        reference: 'JRN_TEST_002',
        idempotencyKey: 'IDEMP_002',
        description: 'Negative amount test',
        entries: [
          {
            accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_DEPOSITS,
            direction: EntryDirection.DEBIT,
            amountKobo: -100n,
          },
          {
            accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
            direction: EntryDirection.CREDIT,
            amountKobo: -100n,
          },
        ],
      };

      await expect(service.postJournal(negativeAmountDto)).rejects.toThrow(
        FinancialInvariantException,
      );
    });

    it('should reject a journal with fewer than two entries', async () => {
      const singleEntryDto = {
        reference: 'JRN_TEST_003',
        idempotencyKey: 'IDEMP_003',
        description: 'Single entry test',
        entries: [
          {
            accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_DEPOSITS,
            direction: EntryDirection.DEBIT,
            amountKobo: 1000n,
          },
        ],
      };

      await expect(service.postJournal(singleEntryDto)).rejects.toThrow(
        FinancialInvariantException,
      );
    });
  });

  describe('Balance Tracking & Idempotency', () => {
    it('should return existing journal when idempotency key is replayed', async () => {
      const existing = {
        id: 'jrn_123',
        reference: 'JRN_001',
        idempotencyKey: 'IDEMP_REPEAT',
        status: JournalStatus.POSTED,
        entries: [],
      };

      mockPrisma.ledgerJournal.findUnique.mockResolvedValue(existing);

      const result = await service.postJournal({
        reference: 'JRN_001',
        idempotencyKey: 'IDEMP_REPEAT',
        description: 'Test',
        entries: [
          { accountNumber: '11100', direction: EntryDirection.DEBIT, amountKobo: 100n },
          { accountNumber: '21000', direction: EntryDirection.CREDIT, amountKobo: 100n },
        ],
      });

      expect(result).toBe(existing);
      expect(mockPrisma.ledgerJournal.create).not.toHaveBeenCalled();
    });

    it('should reject debit if customer liability account would become negative', async () => {
      mockPrisma.ledgerJournal.findUnique.mockResolvedValue(null);

      // Customer deposit account with only 1,000 Kobo
      mockPrisma.ledgerAccount.findUnique.mockImplementation(({ where }: any) => {
        if (where.accountNumber === '21000-CUST-1') {
          return Promise.resolve({
            id: 'acc_cust_1',
            accountNumber: '21000-CUST-1',
            type: LedgerAccountType.LIABILITY,
            balanceKobo: 1000n,
          });
        }
        return Promise.resolve({
          id: 'acc_clearing',
          accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
          type: LedgerAccountType.ASSET,
          balanceKobo: 1000000n,
        });
      });

      const overdrawDto = {
        reference: 'JRN_OVERDRAW',
        idempotencyKey: 'IDEMP_OVERDRAW',
        description: 'Attempted overdraw',
        entries: [
          {
            accountNumber: '21000-CUST-1',
            direction: EntryDirection.DEBIT,
            amountKobo: 5000n, // Attempting to debit 5,000 from 1,000
          },
          {
            accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
            direction: EntryDirection.CREDIT,
            amountKobo: 5000n,
          },
        ],
      };

      await expect(service.postJournal(overdrawDto)).rejects.toThrow(
        FinancialInvariantException,
      );
    });

    it('should successfully post a balanced multi-leg journal', async () => {
      mockPrisma.ledgerJournal.findUnique.mockResolvedValue(null);
      mockPrisma.ledgerJournal.create.mockResolvedValue({
        id: 'jrn_success',
        reference: 'JRN_VALID',
        description: 'Transfer with fee',
      });

      mockPrisma.ledgerAccount.findUnique.mockImplementation(({ where }: any) => {
        if (where.accountNumber === '21000-CUST') {
          return Promise.resolve({
            id: 'cust_acc',
            accountNumber: '21000-CUST',
            type: LedgerAccountType.LIABILITY,
            balanceKobo: 100000n,
          });
        }
        if (where.accountNumber === CHART_OF_ACCOUNTS.PROVIDER_CLEARING) {
          return Promise.resolve({
            id: 'clearing_acc',
            accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
            type: LedgerAccountType.ASSET,
            balanceKobo: 0n,
          });
        }
        if (where.accountNumber === CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE) {
          return Promise.resolve({
            id: 'fee_acc',
            accountNumber: CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE,
            type: LedgerAccountType.REVENUE,
            balanceKobo: 0n,
          });
        }
        return null;
      });

      // Transfer 5,000 + 100 fee = 5,100 total debited from customer
      const validDto = {
        reference: 'JRN_VALID',
        idempotencyKey: 'IDEMP_VALID',
        description: 'Transfer with fee',
        entries: [
          {
            accountNumber: '21000-CUST',
            direction: EntryDirection.DEBIT,
            amountKobo: 5100n,
          },
          {
            accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
            direction: EntryDirection.CREDIT,
            amountKobo: 5000n,
          },
          {
            accountNumber: CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE,
            direction: EntryDirection.CREDIT,
            amountKobo: 100n,
          },
        ],
      };

      const result = await service.postJournal(validDto);
      expect(result.reference).toBe('JRN_VALID');
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledTimes(3);
    });
  });
});
