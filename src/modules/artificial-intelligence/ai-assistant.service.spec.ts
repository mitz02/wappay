import { AIAssistantService } from './services/ai-assistant.service';
import { ConversationHistoryService } from './services/conversation-history.service';
import { IntentParserService } from './services/intent-parser.service';
import { MockFinancialService } from '../mock-financial/services/mock-financial.service';
import { IChatProvider, ChatMessage } from '../../contracts/ai/ai-provider.contract';

describe('AIAssistantService', () => {
  let service: AIAssistantService;
  let mockChatProvider: jest.Mocked<IChatProvider>;
  let historyService: ConversationHistoryService;
  let intentParser: IntentParserService;
  let mockFinancialService: jest.Mocked<MockFinancialService>;
  let mockPrisma: any;

  const sampleCustomer = {
    id: 'cust-123',
    userId: 'user-1',
    fullName: 'Adebayo Ogunlesi',
    whatsappNumber: '2348012345678',
    status: 'ACTIVE',
    dailyLimitKobo: 50_000_000n,
    accountReference: '0123456789',
  };

  beforeEach(() => {
    mockChatProvider = {
      providerName: 'MOCK_GROQ',
      generateChatResponse: jest.fn().mockResolvedValue('Hello Adebayo! How can I help you today?'),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          customerProfile: sampleCustomer,
        }),
      },
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue(sampleCustomer),
      },
      conversationMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      },
    };

    historyService = new ConversationHistoryService(mockPrisma);
    intentParser = new IntentParserService();

    mockFinancialService = {
      resolveMockCustomer: jest.fn().mockResolvedValue(sampleCustomer as any),
      getBalance: jest.fn().mockResolvedValue({
        customerId: 'cust-123',
        customerName: 'Adebayo Ogunlesi',
        accountNumber: '0123456789',
        bankName: 'WAPPay Mock Bank',
        currency: 'NGN',
        availableBalanceKobo: 250_000_00n,
        isSimulated: true,
      }),
      getTransactionHistory: jest.fn().mockResolvedValue([
        {
          id: 'txn-1',
          reference: 'TXN_001',
          type: 'TRANSFER',
          state: 'SUCCESSFUL',
          amountKobo: 5_000_00n,
          feeKobo: 1000n,
          currency: 'NGN',
          createdAt: new Date(),
          isSimulated: true,
        },
      ]),
      createTransferPreview: jest.fn().mockResolvedValue({
        transactionId: 'txn-preview-1',
        internalReference: 'MOCK_TXN_001',
        amountKobo: 5_000_00n,
        feeKobo: 1000n,
        totalDebitKobo: 5_010_00n,
        currency: 'NGN',
        recipientName: 'Jane Adeleke',
        recipientAccountNumber: '0111222333',
        recipientBankName: 'Guaranty Trust Bank',
        challengeToken: 'token123',
        expiresInMinutes: 5,
        isSimulated: true,
      }),
      confirmTransfer: jest.fn().mockResolvedValue({
        transactionId: 'txn-preview-1',
        internalReference: 'MOCK_TXN_001',
        amountKobo: 5_000_00n,
        feeKobo: 1000n,
        totalDebitedKobo: 5_010_00n,
        recipientName: 'Jane Adeleke',
        recipientAccountNumber: '0111222333',
        recipientBankName: 'Guaranty Trust Bank',
        newBalanceKobo: 244_990_00n,
        status: 'SUCCESSFUL',
        settlementMessage: 'Transfer simulated successfully.',
        isSimulated: true,
      }),
      cancelPendingTransfer: jest.fn().mockResolvedValue('Your pending transfer of ₦5,000.00 has been cancelled.'),
      simulateDeposit: jest.fn().mockResolvedValue({
        transactionId: 'dep-1',
        reference: 'MOCK_DEP_001',
        amountCreditedKobo: 50_000_00n,
        newBalanceKobo: 300_000_00n,
        status: 'SUCCESSFUL',
        isSimulated: true,
      }),
      simulateWithdrawal: jest.fn().mockResolvedValue({
        transactionId: 'wth-1',
        reference: 'MOCK_WTH_001',
        amountDebitedKobo: 10_000_00n,
        newBalanceKobo: 240_000_00n,
        status: 'SUCCESSFUL',
        isSimulated: true,
      }),
      simulateAirtimePurchase: jest.fn().mockResolvedValue({
        transactionId: 'air-1',
        reference: 'MOCK_AIR_001',
        type: 'AIRTIME',
        network: 'MTN',
        beneficiaryPhone: '2348012345678',
        packageDetails: '₦1,000 Airtime Top-Up',
        amountDebitedKobo: 100_000n,
        newBalanceKobo: 249_000_00n,
        status: 'SUCCESSFUL',
        isSimulated: true,
      }),
      simulateDataPurchase: jest.fn().mockResolvedValue({
        transactionId: 'dat-1',
        reference: 'MOCK_DAT_001',
        type: 'DATA',
        network: 'MTN',
        beneficiaryPhone: '2348012345678',
        packageDetails: '2GB Data Bundle',
        amountDebitedKobo: 100_000n,
        newBalanceKobo: 249_000_00n,
        status: 'SUCCESSFUL',
        isSimulated: true,
      }),
      listSavedRecipients: jest.fn().mockResolvedValue([
        {
          id: 'rec-1',
          accountName: 'Jane Adeleke',
          accountNumber: '0111222333',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          aliases: ['mum'],
        },
      ]),
    } as any;

    service = new AIAssistantService(
      mockChatProvider,
      historyService,
      intentParser,
      mockFinancialService,
    );
  });

  // -------------------------------------------------------------------------
  // 1. Balance Enquiry
  // -------------------------------------------------------------------------

  it('handles balance enquiry by querying MockFinancialService and returning authoritative balance', async () => {
    const reply = await service.processCustomerMessage('2348012345678', "What's my balance?");

    expect(mockFinancialService.getBalance).toHaveBeenCalledWith('cust-123');
    expect(reply).toContain('Account Balance (Simulated)');
    expect(reply).toContain('₦250,000.00');
    expect(reply).toContain('0123456789');
    expect(reply).toContain('WAPPay Mock Bank');
  });

  // -------------------------------------------------------------------------
  // 2. Transaction History
  // -------------------------------------------------------------------------

  it('handles transaction history request by returning actual transaction records', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Show my transaction history');

    expect(mockFinancialService.getTransactionHistory).toHaveBeenCalledWith('cust-123', 5);
    expect(reply).toContain('Recent Simulated Transactions');
    expect(reply).toContain('TRANSFER');
    expect(reply).toContain('TXN_001');
  });

  // -------------------------------------------------------------------------
  // 3. Fund Transfer (Intent -> Preview Confirmation)
  // -------------------------------------------------------------------------

  it('creates a transfer preview and asks for confirmation when recipient and amount are provided', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Send 5000 naira to Mum');

    expect(mockFinancialService.createTransferPreview).toHaveBeenCalledWith(
      'cust-123',
      'Mum',
      500_000n,
    );
    expect(reply).toContain('Simulated Transfer Confirmation');
    expect(reply).toContain('Jane Adeleke');
    expect(reply).toContain('₦5,000.00');
    expect(reply).toContain('Reply *YES* to confirm');
  });

  it('asks clarifying question when transfer recipient or amount is missing', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Send money');

    expect(mockFinancialService.createTransferPreview).not.toHaveBeenCalled();
    expect(reply).toContain('Missing Transfer Details');
    expect(reply).toContain('Please specify both');
  });

  // -------------------------------------------------------------------------
  // 4. Confirm Pending Transfer
  // -------------------------------------------------------------------------

  it('executes transfer and returns authoritative result when customer confirms with "YES"', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'YES');

    expect(mockFinancialService.confirmTransfer).toHaveBeenCalledWith('cust-123', 'YES');
    expect(reply).toContain('Simulated Transfer Successful!');
    expect(reply).toContain('MOCK_TXN_001');
    expect(reply).toContain('₦244,990.00');
  });

  // -------------------------------------------------------------------------
  // 5. Cancel Pending Transfer
  // -------------------------------------------------------------------------

  it('cancels pending transfer when customer replies "cancel"', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Cancel');

    expect(mockFinancialService.cancelPendingTransfer).toHaveBeenCalledWith('cust-123');
    expect(reply).toContain('Transfer Cancelled');
  });

  // -------------------------------------------------------------------------
  // 6. Simulated Deposit
  // -------------------------------------------------------------------------

  it('executes a simulated deposit when requested', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Deposit 50000');

    expect(mockFinancialService.simulateDeposit).toHaveBeenCalledWith('cust-123', 5_000_000n, expect.any(String));
    expect(reply).toContain('Simulated Deposit Successful!');
    expect(reply).toContain('₦50,000.00');
    expect(reply).toContain('₦300,000.00');
  });

  // -------------------------------------------------------------------------
  // 7. Simulated Withdrawal
  // -------------------------------------------------------------------------

  it('executes a simulated withdrawal when requested', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Withdraw 10000');

    expect(mockFinancialService.simulateWithdrawal).toHaveBeenCalledWith('cust-123', 1_000_000n);
    expect(reply).toContain('Simulated Withdrawal Successful!');
    expect(reply).toContain('₦10,000.00');
  });

  // -------------------------------------------------------------------------
  // 8. Airtime & Data Purchases
  // -------------------------------------------------------------------------

  it('executes an airtime recharge simulation', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Buy 1000 airtime');

    expect(mockFinancialService.simulateAirtimePurchase).toHaveBeenCalledWith(
      'cust-123',
      '2348012345678',
      'MTN',
      100_000n,
    );
    expect(reply).toContain('Simulated Airtime Top-Up Successful!');
  });

  it('executes a data bundle purchase simulation', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Buy 2GB data');

    expect(mockFinancialService.simulateDataPurchase).toHaveBeenCalledWith(
      'cust-123',
      '2348012345678',
      'MTN',
      '2GB',
      100_000n,
    );
    expect(reply).toContain('Simulated Data Bundle Purchase Successful!');
  });

  // -------------------------------------------------------------------------
  // 9. Saved Recipients
  // -------------------------------------------------------------------------

  it('lists saved recipients when requested', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Who are my saved recipients?');

    expect(mockFinancialService.listSavedRecipients).toHaveBeenCalledWith('cust-123');
    expect(reply).toContain('Your Saved Recipients:');
    expect(reply).toContain('Jane Adeleke');
    expect(reply).toContain('mum');
  });

  // -------------------------------------------------------------------------
  // 10. General Conversational / Greetings via Groq
  // -------------------------------------------------------------------------

  it('calls Groq for general conversational greetings', async () => {
    const reply = await service.processCustomerMessage('2348012345678', 'Hello there');

    expect(mockChatProvider.generateChatResponse).toHaveBeenCalledTimes(1);
    expect(reply).toBe('Hello Adebayo! How can I help you today?');
  });
});
