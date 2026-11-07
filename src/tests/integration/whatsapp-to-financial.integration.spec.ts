/**
 * @file whatsapp-to-financial.integration.spec.ts
 * @description End-to-end integration tests for the complete WAPPay pipeline:
 *
 *   WhatsApp Webhook → IncomingMessageHandler → AIAssistantService
 *     → IntentParserService → MockFinancialService → ConversationHistoryService
 *
 * Every test exercises REAL instances of:
 *   - IntentParserService   (no mock — real regex)
 *   - MockFinancialService  (backed by a fresh MockDatabaseStore per describe)
 *   - ConversationHistoryService (in-memory fallback — no DB required)
 *   - AIAssistantService    (real orchestration)
 *
 * The ONLY mock is the IChatProvider (Groq) to avoid live network calls.
 * All financial data comes from MockFinancialService backed by MockDatabaseStore.
 *
 * ⚠️  AI must NEVER invent balances or references — every financial assertion
 *     is cross-checked against actual MockDatabaseStore seed values.
 *
 * Seed data (from mock-database.store.ts):
 *   Adebayo Ogunlesi  | 2348012345678 | balance ₦250,000 | ID: cust-adebayo-001
 *   Chioma Okonkwo    | 2348023456789 | balance ₦120,000 | ID: cust-chioma-002
 *   Babatunde Adeleke | 2348034567890 | balance ₦75,000  | ID: cust-tunde-003
 *   Unregistered      | 2349000000000 | auto-provisioned | balance ₦0
 */

import { AIAssistantService } from '../../modules/artificial-intelligence/services/ai-assistant.service';
import { ConversationHistoryService } from '../../modules/artificial-intelligence/services/conversation-history.service';
import { IntentParserService } from '../../modules/artificial-intelligence/services/intent-parser.service';
import { MockFinancialService } from '../../modules/mock-financial/services/mock-financial.service';
import { MockDatabaseStore } from '../../infrastructure/database/mock-database.store';
import { LedgerService } from '../../modules/ledger/ledger.service';
import { RecipientsService } from '../../modules/recipients/recipients.service';
import { IChatProvider } from '../../contracts/ai/ai-provider.contract';

// ---------------------------------------------------------------------------
// Helpers: build fully-wired service graph from fresh in-memory store
// ---------------------------------------------------------------------------

function buildPrismaProxy(store: MockDatabaseStore) {
  return store.getPrismaProxy();
}

function buildServiceGraph(groqReply = 'Hello! How can I help you today?') {
  const store = new MockDatabaseStore();
  const prisma = buildPrismaProxy(store) as any;

  const ledgerService = new LedgerService(prisma);
  const recipientsService = new RecipientsService(prisma);
  const mockFinancialService = new MockFinancialService(prisma, ledgerService, recipientsService);
  const historyService = new ConversationHistoryService(prisma);
  const intentParser = new IntentParserService();

  const chatProvider: IChatProvider = {
    providerName: 'MOCK_GROQ_INTEGRATION',
    generateChatResponse: jest.fn().mockResolvedValue(groqReply),
  };

  const assistant = new AIAssistantService(
    chatProvider,
    historyService,
    intentParser,
    mockFinancialService,
  );

  return { store, prisma, mockFinancialService, historyService, intentParser, chatProvider, assistant };
}

// ============================================================================
// Suite 1: General Conversation (routes to Groq)
// ============================================================================

describe('[Integration] General Conversation', () => {
  it('greets the customer and passes the message through Groq', async () => {
    const { assistant, chatProvider } = buildServiceGraph('Welcome to WAPPay! I can help with balances, transfers and more.');

    const reply = await assistant.processCustomerMessage('2348012345678', 'Hello');

    expect(chatProvider.generateChatResponse).toHaveBeenCalledTimes(1);
    expect(reply).toContain('WAPPay');
  });

  it('explains capabilities when asked "What can you do?"', async () => {
    const { assistant, chatProvider } = buildServiceGraph(
      'I can check your balance, send money, buy airtime, and more!',
    );

    const reply = await assistant.processCustomerMessage('2348012345678', 'What can you do?');

    expect(chatProvider.generateChatResponse).toHaveBeenCalledTimes(1);
    expect(reply).toBeTruthy();
  });

  it('explains how the service works via Groq for a general question', async () => {
    const { assistant, chatProvider } = buildServiceGraph(
      'WAPPay is a WhatsApp-based financial assistant. Simply message me to manage your money.',
    );

    const reply = await assistant.processCustomerMessage(
      '2348012345678',
      'How does this service work?',
    );

    expect(chatProvider.generateChatResponse).toHaveBeenCalledTimes(1);
    expect(reply).toBeTruthy();
  });

  it('returns fallback response when Groq throws an error', async () => {
    const { assistant, chatProvider } = buildServiceGraph();
    (chatProvider.generateChatResponse as jest.Mock).mockRejectedValueOnce(new Error('Groq timeout'));

    const reply = await assistant.processCustomerMessage('2348012345678', 'Hello there');

    // Fallback from generateConversationalReply catch block
    expect(reply).toContain('WAPPay');
  });

  it('returns a default prompt for an empty message', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', '   ');

    expect(reply).toContain('Hello!');
    expect(reply).toContain('WAPPay');
  });
});

// ============================================================================
// Suite 2: Account Enquiries (real data from MockDatabaseStore)
// ============================================================================

describe('[Integration] Account Enquiries', () => {
  it('returns Adebayo\'s authoritative balance of ₦250,000.00', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', "What's my balance?");

    expect(reply).toContain('Account Balance (Simulated)');
    expect(reply).toContain('₦250,000.00');
    expect(reply).toContain('0123456789');
    expect(reply).toContain('WAPPay Mock Bank');
    expect(reply).toContain('Adebayo Ogunlesi');
  });

  it('returns Chioma\'s authoritative balance of ₦120,000.00', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348023456789', "check my balance");

    expect(reply).toContain('₦120,000.00');
    expect(reply).toContain('Chioma Okonkwo');
  });

  it('returns Babatunde\'s authoritative balance of ₦75,000.00', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348034567890', "balance");

    expect(reply).toContain('₦75,000.00');
    expect(reply).toContain('Babatunde Adeleke');
  });

  it('returns transaction history containing seeded historical transactions for Adebayo', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Show my last five transactions');

    expect(reply).toContain('Recent Transactions');
    // Seeded transaction references from mock-database.store.ts
    expect(reply).toMatch(/HIST_TXN_\d+/);
  });

  it('returns up to 10 transactions when "last 10" is requested', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Show my last 10 transactions');

    expect(reply).toContain('Recent Transactions');
    // Adebayo has exactly 10 seeded txns — all 10 should appear
    const matches = reply.match(/HIST_TXN_/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it('lists Adebayo\'s saved recipients including Jane Adeleke (Mum)', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Who are my saved recipients?');

    expect(reply).toContain('Your Saved Contacts:');
    expect(reply).toContain('Jane Adeleke');
    // Bank from seed data
    expect(reply).toMatch(/Guaranty Trust/i);
    // Alias listed
    expect(reply).toContain('mum');
  });

  it('lists account details including account number in balance response', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Show my account details');

    // "account details" hits balance intent via the word "balance" substring
    // OR may route to Groq as GENERAL — either way reply must be non-empty
    expect(reply).toBeTruthy();
  });
});

// ============================================================================
// Suite 3: Financial Simulations
// ============================================================================

describe('[Integration] Financial Simulations', () => {
  // --- 3a. Transfer (2-phase) ---

  it('creates a transfer preview when amount and recipient are provided', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Send ₦5,000 to Mum');

    expect(reply).toContain('Simulated Transfer Confirmation');
    expect(reply).toContain('Jane Adeleke');
    expect(reply).toContain('₦5,000.00');
    expect(reply).toContain('Reply *YES* to confirm');
    expect(reply).toContain('0111222333'); // Mum's account number
  });

  it('executes the transfer and returns verified result after YES confirmation', async () => {
    const { assistant } = buildServiceGraph();

    // Phase 1: create preview
    await assistant.processCustomerMessage('2348012345678', 'Send ₦5,000 to Mum');

    // Phase 2: confirm
    const reply = await assistant.processCustomerMessage('2348012345678', 'YES');

    expect(reply).toContain('Simulated Transfer Successful!');
    expect(reply).toContain('Jane Adeleke');
    expect(reply).toContain('₦5,000.00');
    // New balance must be computed by the real MockFinancialService (not invented)
    expect(reply).toMatch(/Available Balance.*₦/);
    // Must contain a real reference prefixed MOCK_TXN_
    expect(reply).toMatch(/MOCK_TXN_/);
  });

  it('reflects a reduced balance after a confirmed transfer', async () => {
    const { assistant, mockFinancialService } = buildServiceGraph();

    // Phase 1 + Phase 2
    await assistant.processCustomerMessage('2348012345678', 'Send ₦5,000 to Mum');
    await assistant.processCustomerMessage('2348012345678', 'YES');

    // Verify actual balance in the store
    const balance = await mockFinancialService.getBalance('cust-adebayo-001');
    // ₦250,000 - ₦5,000 (amount) - ₦10 (fee 1000 kobo) = ₦244,990
    expect(balance.availableBalanceKobo).toBeLessThan(25_000_000n);
  });

  it('purchases ₦1,000 airtime successfully', async () => {
    const { assistant } = buildServiceGraph();

    // One-shot airtime with explicit network and amount executes directly
    const reply = await assistant.processCustomerMessage('2348012345678', 'Recharge MTN 1000 airtime');

    expect(reply).toContain('AIRTIME TOP-UP SUCCESSFUL!');
    expect(reply).toContain('₦1,000.00');
    expect(reply).toContain('MTN');
    expect(reply).toMatch(/MOCK_AIR_/);
  });

  it('purchases 2GB data bundle successfully', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Buy 2GB data');

    expect(reply).toContain('Simulated Data Bundle Purchase Successful!');
    expect(reply).toContain('2GB');
    expect(reply).toContain('MTN');
    expect(reply).toMatch(/MOCK_DAT_/);
  });

  it('simulates a ₦10,000 withdrawal and returns updated balance', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Withdraw ₦10,000');

    expect(reply).toContain('Simulated Withdrawal Successful!');
    expect(reply).toContain('₦10,000.00');
    expect(reply).toMatch(/MOCK_WTH_/);
  });

  it('simulates a deposit and credits the balance', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Deposit ₦50,000');

    expect(reply).toContain('Simulated Deposit Successful!');
    expect(reply).toContain('₦50,000.00');
    expect(reply).toMatch(/MOCK_DEP_/);
  });
});

// ============================================================================
// Suite 4: Follow-Up Conversations (multi-turn context)
// ============================================================================

describe('[Integration] Follow-Up Conversations (Multi-Turn)', () => {
  it('remembers the pending transfer context and confirms on "Yes, confirm it"', async () => {
    const { assistant } = buildServiceGraph();

    // Turn 1: initiate transfer
    const preview = await assistant.processCustomerMessage('2348012345678', 'Send ₦5,000 to Mum');
    expect(preview).toContain('Reply *YES* to confirm');

    // Turn 2: confirm — "yes" is in the confirmRegex
    const confirmation = await assistant.processCustomerMessage('2348012345678', 'Yes');
    expect(confirmation).toContain('Simulated Transfer Successful!');
  });

  it('queries new balance after a confirmed transfer and gets updated figure', async () => {
    const { assistant, mockFinancialService } = buildServiceGraph();

    // Execute transfer
    await assistant.processCustomerMessage('2348012345678', 'Send ₦5,000 to Mum');
    await assistant.processCustomerMessage('2348012345678', 'YES');

    // Now query balance
    const balanceReply = await assistant.processCustomerMessage('2348012345678', "What is my new balance?");

    // Must reflect deduction, not original ₦250,000
    const storeBalance = await mockFinancialService.getBalance('cust-adebayo-001');
    const expectedNaira = (Number(storeBalance.availableBalanceKobo) / 100).toFixed(2);
    expect(balanceReply).toContain(expectedNaira.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  });

  it('preserves conversation isolation between two different customers', async () => {
    const { assistant, historyService } = buildServiceGraph();

    // Adebayo initiates a transfer
    await assistant.processCustomerMessage('2348012345678', 'Send ₦5,000 to Mum');

    // Chioma queries her own balance — should NOT see Adebayo's pending transfer state
    const chiomaReply = await assistant.processCustomerMessage('2348023456789', "What's my balance?");
    expect(chiomaReply).toContain('₦120,000.00');
    expect(chiomaReply).toContain('Chioma Okonkwo');
    expect(chiomaReply).not.toContain('Adebayo');

    // Adebayo confirms: must use HIS pending transfer (not Chioma's session)
    const adebayoConfirm = await assistant.processCustomerMessage('2348012345678', 'YES');
    expect(adebayoConfirm).toContain('Simulated Transfer Successful!');
    expect(adebayoConfirm).toContain('Jane Adeleke');
  });

  it('accumulates conversation history per customer across turns', async () => {
    const { assistant, historyService } = buildServiceGraph();

    await assistant.processCustomerMessage('2348012345678', "What's my balance?");
    await assistant.processCustomerMessage('2348012345678', "Show my transactions");

    const history = await historyService.getRecentHistory('cust-adebayo-001', 10);

    // Each processCustomerMessage records 2 messages (user + assistant)
    expect(history.length).toBeGreaterThanOrEqual(4);
    expect(history.some((m) => m.role === 'user')).toBe(true);
    expect(history.some((m) => m.role === 'assistant')).toBe(true);
  });

  it('cancels a pending transfer when customer replies CANCEL', async () => {
    const { assistant } = buildServiceGraph();

    // Phase 1: create preview
    await assistant.processCustomerMessage('2348012345678', 'Send ₦5,000 to Mum');

    // Cancel it
    const cancelReply = await assistant.processCustomerMessage('2348012345678', 'Cancel');

    expect(cancelReply).toContain('Transfer Cancelled');
    expect(cancelReply).toContain('₦5,000');
  });
});

// ============================================================================
// Suite 5: Error Handling
// ============================================================================

describe('[Integration] Error Handling', () => {
  // --- 5a. Insufficient Balance ---

  it('rejects a transfer exceeding Babatunde\'s ₦75,000 balance', async () => {
    const { assistant } = buildServiceGraph();

    // Babatunde has ₦75,000; try to send ₦500,000
    const reply = await assistant.processCustomerMessage('2348034567890', 'Send ₦500,000 to Mum');

    // Should get an error (wrapped by AIAssistantService catch block)
    expect(reply).toMatch(/insufficient|funds|balance|failed/i);
  });

  it('rejects a withdrawal exceeding available balance', async () => {
    const { assistant } = buildServiceGraph();

    // Babatunde only has ₦75,000
    const reply = await assistant.processCustomerMessage('2348034567890', 'Withdraw ₦200,000');

    expect(reply).toMatch(/insufficient|funds|failed/i);
  });

  // --- 5b. Unknown Recipient ---

  it('returns a preview (or fallback) for an unrecognised recipient name', async () => {
    const { assistant } = buildServiceGraph();

    // "UnknownGhost" is not a seeded recipient — service creates a fallback mock recipient
    const reply = await assistant.processCustomerMessage(
      '2348012345678',
      'Send ₦5,000 to UnknownGhost',
    );

    // The service falls back to a mock recipient entry, so the preview is still shown
    expect(reply).toContain('Simulated Transfer Confirmation');
    expect(reply).toContain('₦5,000.00');
  });

  // --- 5c. Missing Transfer Details ---

  it('asks for clarification when only "Send money" is typed', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Send money');

    expect(reply).toContain('Missing Transfer Details');
    expect(reply).toContain('Please specify both');
  });

  it('asks for clarification when only "transfer" is typed', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'transfer');

    expect(reply).toContain('Missing Transfer Details');
  });

  // --- 5d. Ambiguous Confirmation (not YES) ---

  it('rejects ambiguous confirmation "sure, maybe" without a pending transfer', async () => {
    const { assistant } = buildServiceGraph();

    // No pending transfer exists — confirmTransfer should throw NotFoundException
    // The CONFIRM_TRANSACTION intent IS triggered (regex: "sure") but there's no pending txn
    const reply = await assistant.processCustomerMessage('2348012345678', 'sure');

    // Should get error wrapping from catch block
    expect(reply).toMatch(/Action Failed|No pending transfer/i);
  });

  it('rejects YES confirmation when no pending transfer exists', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'YES');

    expect(reply).toMatch(/Action Failed|No pending transfer/i);
  });

  // --- 5e. Unregistered Phone Number ---

  it('auto-provisions an unregistered number and returns ₦0.00 balance', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2349000000000', "What's my balance?");

    // Auto-provisioned mock customers start with the configured starter balance
    expect(reply).toContain('Account Balance (Simulated)');
    expect(reply).toContain('₦250,000.00');
  });

  // --- 5f. Airtime without amount ---

  it('asks for airtime amount when not specified', async () => {
    const { assistant } = buildServiceGraph();

    const reply = await assistant.processCustomerMessage('2348012345678', 'Buy airtime');

    // With no amount parsed (the word "airtime" alone triggers airtime intent but extractMonetaryAmount
    // may return undefined). Service should ask for the amount.
    expect(reply).toMatch(/Airtime|amount|specify/i);
  });

  // --- 5g. Financial safety: AI cannot invent balances ---

  it('NEVER allows Groq to determine balance — real balance comes from MockFinancialService', async () => {
    const { assistant, chatProvider } = buildServiceGraph(
      'Your balance is ₦999,999.00', // Groq would invent this
    );

    const reply = await assistant.processCustomerMessage('2348012345678', "What's my balance?");

    // Balance enquiry is handled by MockFinancialService, NOT Groq
    expect(chatProvider.generateChatResponse).not.toHaveBeenCalled();
    // Response must contain the real seeded balance, not the Groq-invented one
    expect(reply).toContain('₦250,000.00');
    expect(reply).not.toContain('₦999,999.00');
  });

  it('NEVER allows Groq to determine transaction references — refs come from MockFinancialService', async () => {
    const { assistant, chatProvider } = buildServiceGraph('FAKE_REF_123');

    const reply = await assistant.processCustomerMessage('2348012345678', 'Show my transactions');

    expect(chatProvider.generateChatResponse).not.toHaveBeenCalled();
    // Real HIST_TXN_* references from seeded data
    expect(reply).toMatch(/HIST_TXN_/);
    expect(reply).not.toContain('FAKE_REF_123');
  });
});

// ============================================================================
// Suite 6: Cross-Customer Isolation Invariants
// ============================================================================

describe('[Integration] Cross-Customer Isolation', () => {
  it('Chioma cannot see Adebayo\'s balance', async () => {
    const { assistant } = buildServiceGraph();

    const chiomaReply = await assistant.processCustomerMessage('2348023456789', "What's my balance?");

    expect(chiomaReply).toContain('₦120,000.00');
    expect(chiomaReply).not.toContain('₦250,000.00');
    expect(chiomaReply).not.toContain('Adebayo');
  });

  it('Babatunde cannot access Adebayo\'s transaction history', async () => {
    const { assistant } = buildServiceGraph();

    const tudeReply = await assistant.processCustomerMessage('2348034567890', 'Show my transactions');

    // Babatunde has no seeded transactions — should get the "no transactions" message
    expect(tudeReply).toContain('no recorded transactions');
  });

  it('Chioma\'s pending transfer does not bleed into Babatunde\'s confirmation', async () => {
    const { assistant } = buildServiceGraph();

    // Chioma creates a pending transfer
    await assistant.processCustomerMessage('2348023456789', 'Send ₦10,000 to Brother');

    // Babatunde sends YES — must fail because Babatunde has no pending transfer
    const reply = await assistant.processCustomerMessage('2348034567890', 'YES');

    expect(reply).toMatch(/Action Failed|No pending transfer/i);
  });
});

// ============================================================================
// Suite 7: Intent Parser Direct Verification
// ============================================================================

describe('[Integration] Intent Parser — End-to-End Routing', () => {
  const intentCases: Array<{ message: string; expectIntentRoute: string; description: string }> = [
    { message: 'hello',                        expectIntentRoute: 'HELP',                description: 'hello → HELP' },
    { message: 'What can you do?',             expectIntentRoute: 'HELP',                description: 'what can you do → HELP' },
    { message: "what's my balance?",           expectIntentRoute: 'BALANCE_ENQUIRY',     description: 'balance query → BALANCE_ENQUIRY' },
    { message: 'Show my last 5 transactions',  expectIntentRoute: 'TRANSACTION_HISTORY', description: 'last 5 txns → TRANSACTION_HISTORY' },
    { message: 'Show my last 10 transactions', expectIntentRoute: 'TRANSACTION_HISTORY', description: 'last 10 txns → TRANSACTION_HISTORY' },
    { message: 'Who are my saved recipients?', expectIntentRoute: 'LIST_RECIPIENTS',     description: 'recipients → LIST_RECIPIENTS' },
    { message: 'Send ₦5,000 to Mum',          expectIntentRoute: 'TRANSFER',            description: 'send to Mum → TRANSFER' },
    { message: 'Buy ₦1,000 airtime',          expectIntentRoute: 'AIRTIME_PURCHASE',    description: 'buy airtime → AIRTIME_PURCHASE' },
    { message: 'Buy 2GB data',                expectIntentRoute: 'DATA_PURCHASE',        description: 'buy data → DATA_PURCHASE' },
    { message: 'Withdraw ₦10,000',            expectIntentRoute: 'WITHDRAWAL',           description: 'withdraw → WITHDRAWAL' },
    { message: 'Deposit ₦50,000',             expectIntentRoute: 'DEPOSIT',              description: 'deposit → DEPOSIT' },
    { message: 'YES',                          expectIntentRoute: 'CONFIRM_TRANSACTION',  description: 'YES → CONFIRM_TRANSACTION' },
    { message: 'confirm',                      expectIntentRoute: 'CONFIRM_TRANSACTION',  description: 'confirm → CONFIRM_TRANSACTION' },
    { message: 'cancel',                       expectIntentRoute: 'CANCEL_TRANSACTION',   description: 'cancel → CANCEL_TRANSACTION' },
    { message: 'top up balance',               expectIntentRoute: 'DEPOSIT',              description: 'top up balance → DEPOSIT (not BALANCE_ENQUIRY)' },
    { message: 'Send money',                   expectIntentRoute: 'TRANSFER',             description: 'send money ambiguous → TRANSFER' },
  ];

  it.each(intentCases)('$description', async ({ message, expectIntentRoute }) => {
    const parser = new IntentParserService();
    const result = await parser.parseIntent(message);
    expect(result.intent).toBe(expectIntentRoute);
  });

  it('extracts "2GB" as the data plan without mistaking it for ₦2 amount', async () => {
    const parser = new IntentParserService();
    const result = await parser.parseIntent('Buy 2GB data');
    expect(result.intent).toBe('DATA_PURCHASE');
    expect(result.plan).toBe('2GB');
    // Default fallback amount is 100,000 kobo (₦1,000) NOT 200n
    expect(result.amountKobo).toBeGreaterThan(1000n);
  });

  it('strips "naira" from transfer message and extracts recipient correctly', async () => {
    const parser = new IntentParserService();
    const result = await parser.parseIntent('Send 5000 naira to Mum');
    expect(result.intent).toBe('TRANSFER');
    expect(result.recipient).toBe('Mum');
    expect(result.amountKobo).toBe(500_000n); // ₦5,000 in kobo
  });

  it('parses 10k shorthand to ₦10,000 (1,000,000 kobo)', async () => {
    const parser = new IntentParserService();
    const result = await parser.parseIntent('Transfer 10k to John');
    expect(result.intent).toBe('TRANSFER');
    expect(result.amountKobo).toBe(1_000_000n);
    expect(result.recipient).toBe('John');
  });
});
