import { ConversationRouterService } from '../../src/modules/messaging/conversation-router.service';
import { TransactionsService } from '../../src/modules/transactions/transactions.service';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { AIService } from '../../src/modules/artificial-intelligence/ai.service';
import { SandboxProviderAdapter } from '../../src/modules/financial-providers/sandbox-provider.adapter';
import { EntryDirection, LedgerAccountType, TransactionState } from '@prisma/client';
import { CHART_OF_ACCOUNTS } from '../../src/common/constants';

describe('End-to-End Sandbox Lifecycle Scenario', () => {
  let router: ConversationRouterService;
  let txnService: TransactionsService;
  let ledgerService: LedgerService;
  let aiService: AIService;
  let provider: SandboxProviderAdapter;

  let mockPrisma: any;
  let mockCustomers: any;
  let mockRecipients: any;
  let mockAuth: any;
  let mockMessaging: any;

  beforeEach(() => {
    // In-memory simulated state
    const customer = {
      id: 'cust_sandbox_1',
      fullName: 'David Adeleke',
      whatsappNumber: '+2348012345678',
      dailyLimitKobo: 50_000_000n, // 500,000 NGN
      pinHash: '$argon2id$mock_pin_hash',
      failedPinAttempts: 0,
      pinLockedUntil: null,
    };

    const recipient = {
      id: 'rec_mum',
      customerId: customer.id,
      accountName: 'Jane Adeleke',
      accountNumber: '0123456789',
      bankCode: '058',
      bankName: 'Guaranty Trust Bank',
    };

    let customerBalanceKobo = 200_000_00n; // Initial 200,000 NGN available deposit
    let reservedBalanceKobo = 0n;
    let providerClearingKobo = 0n;
    let feeRevenueKobo = 0n;

    const postedJournals: any[] = [];
    const transactions: any[] = [];
    const authorizations: any[] = [];
    const events: any[] = [];

    mockPrisma = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue(customer),
        update: jest.fn(),
      },
      recipient: {
        findUnique: jest.fn().mockResolvedValue(recipient),
      },
      ledgerAccount: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          if (where.accountNumber === `21000-${customer.id}`) {
            return Promise.resolve({
              id: 'acc_cust_dep',
              accountNumber: `21000-${customer.id}`,
              type: LedgerAccountType.LIABILITY,
              balanceKobo: customerBalanceKobo,
            });
          }
          if (where.accountNumber === CHART_OF_ACCOUNTS.CUSTOMER_RESERVED) {
            return Promise.resolve({
              id: 'acc_reserved',
              accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_RESERVED,
              type: LedgerAccountType.LIABILITY,
              balanceKobo: reservedBalanceKobo,
            });
          }
          if (where.accountNumber === CHART_OF_ACCOUNTS.PROVIDER_CLEARING) {
            return Promise.resolve({
              id: 'acc_clearing',
              accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING,
              type: LedgerAccountType.ASSET,
              balanceKobo: providerClearingKobo,
            });
          }
          if (where.accountNumber === CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE) {
            return Promise.resolve({
              id: 'acc_fee',
              accountNumber: CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE,
              type: LedgerAccountType.REVENUE,
              balanceKobo: feeRevenueKobo,
            });
          }
          return null;
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          if (where.id === 'acc_cust_dep') customerBalanceKobo = data.balanceKobo;
          if (where.id === 'acc_reserved') reservedBalanceKobo = data.balanceKobo;
          if (where.id === 'acc_clearing') providerClearingKobo = data.balanceKobo;
          if (where.id === 'acc_fee') feeRevenueKobo = data.balanceKobo;
          return Promise.resolve();
        }),
      },
      ledgerJournal: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const j = { id: `jrn_${postedJournals.length + 1}`, ...data };
          postedJournals.push(j);
          return Promise.resolve(j);
        }),
      },
      ledgerEntry: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
      transaction: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          const t = transactions.find(
            (item) => item.id === where.id || item.idempotencyKey === where.idempotencyKey,
          );
          if (!t) return Promise.resolve(null);
          const auths = authorizations.filter((a) => a.transactionId === t.id);
          return Promise.resolve({ ...t, authorizations: auths, customer });
        }),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const t = { id: `txn_${transactions.length + 1}`, ...data };
          transactions.push(t);
          return Promise.resolve(t);
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          const t = transactions.find((item) => item.id === where.id);
          if (t) Object.assign(t, data);
          return Promise.resolve(t);
        }),
      },
      transactionEvent: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          events.push(data);
          return Promise.resolve(data);
        }),
      },
      transactionAuthorization: {
        findFirst: jest.fn().mockImplementation(() => {
          const activeAuth = authorizations.find((a) => !a.isUsed);
          if (activeAuth) {
            const txn = transactions.find((t) => t.id === activeAuth.transactionId);
            return Promise.resolve({ ...activeAuth, transaction: txn });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const a = { id: `auth_${authorizations.length + 1}`, ...data };
          authorizations.push(a);
          return Promise.resolve(a);
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) => {
          const a = authorizations.find((item) => item.id === where.id);
          if (a) Object.assign(a, data);
          return Promise.resolve(a);
        }),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockCustomers = {
      findOrCreateCustomer: jest.fn().mockResolvedValue(customer),
    };

    mockRecipients = {
      resolveRecipient: jest.fn().mockResolvedValue(recipient),
    };

    mockAuth = {
      verifyCustomerPin: jest.fn().mockImplementation((_cid, pin) => {
        return Promise.resolve({ success: pin === '1234' });
      }),
    };

    mockMessaging = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };

    provider = new SandboxProviderAdapter();
    ledgerService = new LedgerService(mockPrisma);
    txnService = new TransactionsService(
      mockPrisma,
      ledgerService,
      mockRecipients,
      mockAuth,
      provider,
    );
    aiService = new AIService();
    router = new ConversationRouterService(
      mockPrisma,
      mockCustomers,
      aiService,
      txnService,
      mockMessaging,
    );
  });

  it('executes a complete end-to-end sandbox transfer from inbound WhatsApp message to balanced ledger settlement', async () => {
    // 1. Inbound WhatsApp message: "Send ₦5,000 to Mum"
    const step1Response = await router.handleIncomingMessage(
      '+2348012345678',
      'Send ₦5,000 to Mum',
      'David Adeleke',
    );

    // Assert: User receives a Transaction Confirmation preview with fee and details
    expect(step1Response).toContain('Transaction Confirmation');
    expect(step1Response).toContain('Jane Adeleke');
    expect(step1Response).toContain('₦5,000.00');
    expect(step1Response).toContain('Reply with your 4-digit PIN');

    // 2. Customer replies with PIN: "1234"
    const step2Response = await router.handleIncomingMessage(
      '+2348012345678',
      '1234',
      'David Adeleke',
    );

    // Assert: Transfer succeeds and customer receives receipt
    expect(step2Response).toContain('Transfer Successful');
    expect(step2Response).toContain('₦5,000.00');
    expect(step2Response).toContain('Jane Adeleke');

    // 3. Customer checks balance: "How much money do I have?"
    const step3Response = await router.handleIncomingMessage(
      '+2348012345678',
      'How much money do I have?',
      'David Adeleke',
    );

    // Balance was ₦200,000. Debited: ₦5,000 + ₦10 fee = ₦5,010. Remaining: ₦194,990.00
    expect(step3Response).toContain('₦194,990.00');
  });
});
