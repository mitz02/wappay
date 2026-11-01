import { TransactionsService } from './transactions.service';
import { TransactionStateMachine } from './state-machine/transaction-state-machine';
import { TransactionState } from '@prisma/client';
import { InvalidStateTransitionException, InsufficientFundsException } from '../../common/exceptions';

describe('TransactionsService & State Machine Invariants', () => {
  let service: TransactionsService;
  let mockPrisma: any;
  let mockLedger: any;
  let mockRecipients: any;
  let mockAuth: any;
  let mockProvider: any;

  beforeEach(() => {
    mockPrisma = {
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerProfile: {
        findUnique: jest.fn(),
      },
      ledgerAccount: {
        findUnique: jest.fn(),
      },
      transactionEvent: {
        create: jest.fn(),
      },
      transactionAuthorization: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockLedger = {
      postJournal: jest.fn(),
    };

    mockRecipients = {
      resolveRecipient: jest.fn(),
    };

    mockAuth = {
      verifyCustomerPin: jest.fn(),
    };

    mockProvider = {
      providerName: 'MOCK_PROVIDER',
      isSandbox: true,
      initiateTransfer: jest.fn(),
    };

    service = new TransactionsService(
      mockPrisma,
      mockLedger,
      mockRecipients,
      mockAuth,
      mockProvider,
    );
  });

  describe('State Machine Invariants', () => {
    it('should prohibit illegal transition from CREATED to SUCCESSFUL directly', () => {
      expect(() => {
        TransactionStateMachine.validateTransition(
          TransactionState.CREATED,
          TransactionState.SUCCESSFUL,
        );
      }).toThrow(InvalidStateTransitionException);
    });

    it('should prohibit transition from SUCCESSFUL to FAILED on network drop', () => {
      expect(() => {
        TransactionStateMachine.validateTransition(
          TransactionState.SUCCESSFUL,
          TransactionState.FAILED,
        );
      }).toThrow(InvalidStateTransitionException);
    });

    it('should allow valid transition sequence CREATED -> VALIDATING -> AWAITING_AUTHORIZATION -> AUTHORIZED -> PROCESSING -> SUCCESSFUL', () => {
      expect(() => {
        TransactionStateMachine.validateTransition(TransactionState.CREATED, TransactionState.VALIDATING);
        TransactionStateMachine.validateTransition(TransactionState.VALIDATING, TransactionState.AWAITING_AUTHORIZATION);
        TransactionStateMachine.validateTransition(TransactionState.AWAITING_AUTHORIZATION, TransactionState.AUTHORIZED);
        TransactionStateMachine.validateTransition(TransactionState.AUTHORIZED, TransactionState.PROCESSING);
        TransactionStateMachine.validateTransition(TransactionState.PROCESSING, TransactionState.SUCCESSFUL);
      }).not.toThrow();
    });
  });

  describe('Balance Check Invariants', () => {
    it('should reject transfer intent if customer available balance is less than amount + fee', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.customerProfile.findUnique.mockResolvedValue({
        id: 'cust_1',
        dailyLimitKobo: 50000000n,
      });
      mockRecipients.resolveRecipient.mockResolvedValue({
        accountNumber: '0123456789',
        bankCode: '058',
        accountName: 'Jane Doe',
        bankName: 'GTBank',
      });

      // Customer only has 1,000 Kobo available
      mockPrisma.ledgerAccount.findUnique.mockResolvedValue({
        balanceKobo: 1000n,
      });

      await expect(
        service.createTransferIntent({
          customerId: 'cust_1',
          recipientAliasOrName: 'Mum',
          amountKobo: 500000n, // 5,000 NGN
          idempotencyKey: 'IDEMP_TXN_001',
        }),
      ).rejects.toThrow(InsufficientFundsException);
    });
  });
});
