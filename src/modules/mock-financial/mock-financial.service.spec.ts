import { MockFinancialService } from './services/mock-financial.service';
import { LedgerService } from '../ledger/ledger.service';
import { RecipientsService } from '../recipients/recipients.service';
import { BadRequestException } from '@nestjs/common';
import { InsufficientFundsException, UnauthorizedTransactionException } from '../../common/exceptions';
import { TransactionState, TransactionType, EntryDirection, CustomerStatus, KycTier } from '@prisma/client';

describe('MockFinancialService', () => {
  let service: MockFinancialService;
  let mockPrisma: any;
  let mockLedgerService: jest.Mocked<LedgerService>;
  let mockRecipientsService: jest.Mocked<RecipientsService>;

  const mockCustomer = {
    id: 'cust-001',
    userId: 'user-001',
    fullName: 'Adebayo Ogunlesi',
    whatsappNumber: '2348012345678',
    status: CustomerStatus.ACTIVE,
    kycTier: KycTier.TIER_2,
    dailyLimitKobo: 50_000_000n,
    accountReference: '0123456789',
  };

  beforeEach(() => {
    mockPrisma = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue(mockCustomer),
        findFirst: jest.fn().mockResolvedValue(mockCustomer),
        create: jest.fn().mockResolvedValue(mockCustomer),
      },
      user: {
        upsert: jest.fn().mockResolvedValue({ id: 'user-001' }),
      },
      ledgerAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'acc-001',
          accountNumber: '21000-cust-001',
          balanceKobo: 250_000_00n, // ₦250,000.00
        }),
        upsert: jest.fn().mockResolvedValue({ id: 'acc-001' }),
        create: jest.fn().mockResolvedValue({ id: 'acc-new' }),
      },
      transaction: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      transactionAuthorization: {
        create: jest.fn().mockResolvedValue({ id: 'auth-1' }),
        update: jest.fn().mockResolvedValue({ id: 'auth-1' }),
      },
      $transaction: jest.fn().mockImplementation((fnOrArray) => {
        if (typeof fnOrArray === 'function') {
          return fnOrArray(mockPrisma);
        }
        return Promise.all(fnOrArray);
      }),
    };

    mockLedgerService = {
      postJournal: jest.fn().mockResolvedValue({ status: 'POSTED' }),
    } as any;

    mockRecipientsService = {
      resolveRecipient: jest.fn().mockResolvedValue({
        id: 'rec-1',
        accountName: 'Jane Adeleke',
        accountNumber: '0111222333',
        bankCode: '058',
        bankName: 'Guaranty Trust Bank',
      } as any),
      getCustomerRecipients: jest.fn().mockResolvedValue([
        {
          id: 'rec-1',
          accountName: 'Jane Adeleke',
          accountNumber: '0111222333',
          bankCode: '058',
          bankName: 'Guaranty Trust Bank',
          aliases: [{ alias: 'mum' }],
        } as any,
      ]),
    } as any;

    service = new MockFinancialService(
      mockPrisma,
      mockLedgerService,
      mockRecipientsService,
    );
  });

  // -------------------------------------------------------------------------
  // 1. Customer Identification & Isolation
  // -------------------------------------------------------------------------

  describe('resolveMockCustomer()', () => {
    it('returns existing customer profile when WhatsApp number matches', async () => {
      const customer = await service.resolveMockCustomer('2348012345678');
      expect(customer.fullName).toBe('Adebayo Ogunlesi');
      expect(customer.whatsappNumber).toBe('2348012345678');
    });

    it('provisions new mock customer and dedicated ledger account if not yet registered', async () => {
      mockPrisma.customerProfile.findUnique.mockResolvedValueOnce(null);
      const newCust = { ...mockCustomer, id: 'cust-new', whatsappNumber: '2348099999999' };
      mockPrisma.customerProfile.create.mockResolvedValueOnce(newCust);

      // ensureCustomerAccount uses ledgerAccount.findUnique + create (not upsert)
      mockPrisma.ledgerAccount.findUnique.mockResolvedValueOnce(null); // no pre-existing account

      const customer = await service.resolveMockCustomer('2348099999999', 'New Tester');
      expect(mockPrisma.customerProfile.create).toHaveBeenCalled();
      expect(mockPrisma.ledgerAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ accountNumber: '21000-cust-new' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Balance Enquiry
  // -------------------------------------------------------------------------

  describe('getBalance()', () => {
    it('returns customer simulated balance in minor units and NGN attributes', async () => {
      const balance = await service.getBalance('cust-001');

      expect(balance.customerId).toBe('cust-001');
      expect(balance.customerName).toBe('Adebayo Ogunlesi');
      expect(balance.availableBalanceKobo).toBe(250_000_00n);
      expect(balance.bankName).toBe('WAPPay Mock Bank');
      expect(balance.isSimulated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Transaction History
  // -------------------------------------------------------------------------

  describe('getTransactionHistory()', () => {
    it('retrieves recent transactions limited to specified count', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        {
          id: 't-1',
          internalReference: 'TXN_001',
          type: TransactionType.DEPOSIT,
          state: TransactionState.SUCCESSFUL,
          amountKobo: 50_000_00n,
          feeKobo: 0n,
          currency: 'NGN',
          isSimulated: true,
          createdAt: new Date(),
        },
      ]);

      const history = await service.getTransactionHistory('cust-001', 5);
      expect(history).toHaveLength(1);
      expect(history[0].reference).toBe('TXN_001');
      expect(history[0].type).toBe(TransactionType.DEPOSIT);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Simulated Transfers (Preview -> Confirm)
  // -------------------------------------------------------------------------

  describe('Transfers (Preview & Execution)', () => {
    it('creates a transfer preview and issues 5-minute authorization challenge', async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce({
        id: 'txn-new-1',
        internalReference: 'MOCK_TXN_001',
      });

      const preview = await service.createTransferPreview('cust-001', 'Mum', 5_000_00n);

      expect(preview.recipientName).toBe('Jane Adeleke');
      expect(preview.amountKobo).toBe(5_000_00n);
      expect(preview.feeKobo).toBe(1000n);
      expect(preview.totalDebitKobo).toBe(5_010_00n);
      expect(preview.expiresInMinutes).toBe(5);
      expect(preview.challengeToken).toBeDefined();
    });

    it('rejects transfer when available balance is insufficient', async () => {
      mockPrisma.ledgerAccount.findUnique.mockResolvedValueOnce({
        balanceKobo: 2_000_00n, // Only ₦2,000 available
      });

      await expect(
        service.createTransferPreview('cust-001', 'Mum', 5_000_00n),
      ).rejects.toThrow(InsufficientFundsException);
    });

    it('prevents self-transfers to own account number', async () => {
      mockRecipientsService.resolveRecipient.mockResolvedValueOnce({
        accountNumber: '0123456789', // Same as mockCustomer.accountReference
        accountName: 'Adebayo Ogunlesi',
      } as any);

      await expect(
        service.createTransferPreview('cust-001', '0123456789', 5_000_00n),
      ).rejects.toThrow(BadRequestException);
    });

    it('executes atomic transfer and balanced double-entry ledger entries upon confirmation', async () => {
      const pendingTxn = {
        id: 'txn-pend-1',
        internalReference: 'MOCK_TXN_001',
        amountKobo: 5_000_00n,
        feeKobo: 1000n,
        destinationAccountNumber: '0111222333',
        destinationBankCode: '058',
        destinationAccountName: 'Jane Adeleke',
        authorizations: [
          { id: 'auth-1', isUsed: false, expiresAt: new Date(Date.now() + 60000) },
        ],
      };
      mockPrisma.transaction.findMany.mockResolvedValueOnce([pendingTxn]);

      const result = await service.confirmTransfer('cust-001', 'YES');

      expect(result.status).toBe('SUCCESSFUL');
      expect(result.internalReference).toBe('MOCK_TXN_001');
      expect(mockLedgerService.postJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ direction: EntryDirection.DEBIT, amountKobo: 5_010_00n }),
            expect.objectContaining({ direction: EntryDirection.CREDIT, amountKobo: 5_000_00n }),
            expect.objectContaining({ direction: EntryDirection.CREDIT, amountKobo: 1000n }),
          ]),
        }),
      );
    });

    it('rejects confirmation if authorization challenge has expired', async () => {
      const expiredTxn = {
        id: 'txn-exp-1',
        amountKobo: 5_000_00n,
        feeKobo: 1000n,
        authorizations: [
          { id: 'auth-1', isUsed: false, expiresAt: new Date(Date.now() - 60000) }, // Expired
        ],
      };
      mockPrisma.transaction.findMany.mockResolvedValueOnce([expiredTxn]);

      await expect(service.confirmTransfer('cust-001', 'YES')).rejects.toThrow(
        UnauthorizedTransactionException,
      );
    });

    it('cancels pending transfer when customer requests cancellation', async () => {
      const pendingTxn = {
        id: 'txn-cancel-1',
        amountKobo: 5_000_00n,
        authorizations: [{ id: 'auth-1', isUsed: false }],
      };
      mockPrisma.transaction.findFirst.mockResolvedValueOnce(pendingTxn);

      const msg = await service.cancelPendingTransfer('cust-001');
      expect(msg).toContain('cancelled');
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: TransactionState.CANCELLED }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. Simulated Deposits & Withdrawals
  // -------------------------------------------------------------------------

  describe('Deposits & Withdrawals', () => {
    it('simulates deposit, credits customer liability, and debits partner escrow in ledger', async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce({ id: 'dep-1' });

      const result = await service.simulateDeposit('cust-001', 50_000_00n);

      expect(result.status).toBe('SUCCESSFUL');
      expect(result.amountCreditedKobo).toBe(50_000_00n);
      expect(mockLedgerService.postJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [
            expect.objectContaining({ accountNumber: '11100', direction: EntryDirection.DEBIT }),
            expect.objectContaining({ accountNumber: '21000-cust-001', direction: EntryDirection.CREDIT }),
          ],
        }),
      );
    });

    it('simulates withdrawal and debits customer liability in ledger', async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce({ id: 'wth-1' });

      const result = await service.simulateWithdrawal('cust-001', 10_000_00n);

      expect(result.status).toBe('SUCCESSFUL');
      expect(result.amountDebitedKobo).toBe(10_000_00n);
      expect(mockLedgerService.postJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: [
            expect.objectContaining({ accountNumber: '21000-cust-001', direction: EntryDirection.DEBIT }),
            expect.objectContaining({ accountNumber: '11100', direction: EntryDirection.CREDIT }),
          ],
        }),
      );
    });

    it('rejects withdrawal if funds are insufficient', async () => {
      mockPrisma.ledgerAccount.findUnique.mockResolvedValueOnce({
        balanceKobo: 5_000_00n,
      });

      await expect(service.simulateWithdrawal('cust-001', 10_000_00n)).rejects.toThrow(
        InsufficientFundsException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. Airtime & Data Purchases
  // -------------------------------------------------------------------------

  describe('VAS Purchases (Airtime & Data)', () => {
    it('simulates airtime purchase with double-entry commission posting', async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce({ id: 'air-1' });

      const result = await service.simulateAirtimePurchase(
        'cust-001',
        '2348012345678',
        'MTN',
        100_000n, // ₦1,000
      );

      expect(result.status).toBe('SUCCESSFUL');
      expect(result.type).toBe('AIRTIME');
      expect(result.network).toBe('MTN');
      expect(mockLedgerService.postJournal).toHaveBeenCalled();
    });

    it('simulates data purchase with double-entry commission posting', async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce({ id: 'dat-1' });

      const result = await service.simulateDataPurchase(
        'cust-001',
        '2348012345678',
        'MTN',
        '2GB',
        100_000n,
      );

      expect(result.status).toBe('SUCCESSFUL');
      expect(result.type).toBe('DATA');
      expect(result.packageDetails).toBe('2GB Data Bundle');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Gifting
  // -------------------------------------------------------------------------

  describe('simulateGift()', () => {
    it('simulates a cash gift with double-entry posting', async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce({ id: 'gft-1' });

      const result = await service.simulateGift(
        'cust-001',
        'CASH',
        '2348098765432',
        500_000n,
        undefined,
        undefined,
        'Happy Birthday',
      );

      expect(result.status).toBe('SUCCESSFUL');
      expect(result.giftType).toBe('CASH');
      expect(result.recipientPhone).toBe('2348098765432');
      expect(result.note).toBe('Happy Birthday');
      expect(mockLedgerService.postJournal).toHaveBeenCalledTimes(1);
    });

    it('simulates an airtime gift with VAS commission split', async () => {
      mockPrisma.transaction.create.mockResolvedValueOnce({ id: 'gft-2' });

      const result = await service.simulateGift(
        'cust-001',
        'AIRTIME',
        '2348098765432',
        100_000n,
        'MTN',
        undefined,
        'Enjoy',
      );

      expect(result.giftType).toBe('AIRTIME');
      expect(result.network).toBe('MTN');
      expect(mockLedgerService.postJournal).toHaveBeenCalledTimes(1);
    });

    it('rejects an invalid recipient phone number', async () => {
      await expect(
        service.simulateGift('cust-001', 'CASH', 'abc', 500_000n),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Saved Recipients Listing
  // -------------------------------------------------------------------------

  describe('listSavedRecipients()', () => {
    it('returns saved recipients with aliases', async () => {
      const recipients = await service.listSavedRecipients('cust-001');

      expect(recipients).toHaveLength(1);
      expect(recipients[0].accountName).toBe('Jane Adeleke');
      expect(recipients[0].aliases).toContain('mum');
    });
  });
});
