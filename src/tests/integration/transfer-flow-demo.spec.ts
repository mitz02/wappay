import { MockDatabaseStore } from '../../infrastructure/database/mock-database.store';
import { MockFinancialService } from '../../modules/mock-financial/services/mock-financial.service';
import { LedgerService } from '../../modules/ledger/ledger.service';
import { RecipientsService } from '../../modules/recipients/recipients.service';
import { ConversationHistoryService } from '../../modules/artificial-intelligence/services/conversation-history.service';
import { IntentParserService } from '../../modules/artificial-intelligence/services/intent-parser.service';
import { AIAssistantService } from '../../modules/artificial-intelligence/services/ai-assistant.service';
import { IChatProvider } from '../../contracts/ai/ai-provider.contract';

function setupAssistant() {
  const store = new MockDatabaseStore();
  const prisma = store.getPrismaProxy() as any;
  const ledgerService = new LedgerService(prisma);
  const recipientsService = new RecipientsService(prisma);
  const mockFinancialService = new MockFinancialService(prisma, ledgerService, recipientsService);
  const historyService = new ConversationHistoryService(prisma);
  const intentParser = new IntentParserService();

  const chatProvider: IChatProvider = {
    providerName: 'DEMO_GROQ',
    generateChatResponse: jest.fn().mockResolvedValue('OK'),
  };

  const assistant = new AIAssistantService(
    chatProvider,
    historyService,
    intentParser,
    mockFinancialService,
  );

  return { assistant, mockFinancialService };
}

describe('[Interactive Demo] Send Money Flow with Secure PIN Input', () => {
  const PHONE = '2348012345678'; // Adebayo Ogunlesi

  it('demonstrates Flow A: Direct transfer with details given initially', async () => {
    const { assistant, mockFinancialService } = setupAssistant();

    console.log('\n======================================================');
    console.log('📌 FLOW A: User gives details upfront (e.g. "Send ₦5,000 to Mum")');
    console.log('======================================================');

    // Step 1: User sends intent & details
    console.log('\n📲 [Step 1] Customer says:');
    console.log('   "Send ₦5,000 to Mum"');
    const previewReply = await assistant.processCustomerMessage(PHONE, 'Send ₦5,000 to Mum');
    console.log('\n🤖 [Step 1 Response] Bot confirms details & shows "Enter PIN" button:');
    console.log(previewReply);

    expect(previewReply).toContain('Simulated Transfer Confirmation');
    expect(previewReply).toContain('Jane Adeleke');
    expect(previewReply).toContain('₦5,000.00');
    expect(previewReply).toContain('Enter Transaction PIN');
    expect(previewReply).not.toContain('Reply *YES*');

    // Security Verification: What if customer tries to type their PIN in chat?
    console.log('\n🔒 [Security Test] If Customer tries to type PIN "1234" in chat:');
    const chatPinAttempt = await assistant.processCustomerMessage(PHONE, '1234');
    console.log(chatPinAttempt);
    expect(chatPinAttempt).toContain('Security Warning');
    expect(chatPinAttempt).toContain('PIN Cannot Be Sent as Chat');

    // Step 2: Customer taps "Enter PIN" button -> opens WhatsApp Flow -> enters PIN in input field
    console.log('\n📲 [Step 2] Customer taps "Enter PIN" button & enters PIN in input field:');
    const resultReply = await assistant.submitTransferPin(PHONE, '1234');
    console.log('\n🤖 [Step 2 Response] Bot executes transfer:');
    console.log(resultReply);

    expect(resultReply).toContain('Simulated Transfer Successful!');
    expect(resultReply).toContain('Jane Adeleke');
    expect(resultReply).toContain('₦5,000.00');

    // Check balance deduction
    const balance = await mockFinancialService.getBalance('cust-adebayo-001');
    console.log(`\n💰 Updated Wallet Balance: ₦${(Number(balance.availableBalanceKobo) / 100).toLocaleString()}`);
    expect(balance.availableBalanceKobo).toBeLessThan(25_000_000n);
  });

  it('demonstrates Flow B: User intent with missing details initially', async () => {
    const { assistant } = setupAssistant();

    console.log('\n======================================================');
    console.log('📌 FLOW B: Intent without details (e.g. "I want to send money")');
    console.log('======================================================');

    // Step 1: Intent without details
    console.log('\n📲 [Step 1] Customer says:');
    console.log('   "I want to send money"');
    const step1 = await assistant.processCustomerMessage(PHONE, 'I want to send money');
    console.log('\n🤖 [Step 1 Response] Bot asks for details:');
    console.log(step1);
    expect(step1).toContain('Missing Transfer Details');

    // Step 2: Customer provides details
    console.log('\n📲 [Step 2] Customer provides details:');
    console.log('   "5000 to Mum"');
    const step2 = await assistant.processCustomerMessage(PHONE, '5000 to Mum');
    console.log('\n🤖 [Step 2 Response] Bot confirms details & shows "Enter PIN" button:');
    console.log(step2);
    expect(step2).toContain('Simulated Transfer Confirmation');
    expect(step2).toContain('Enter Transaction PIN');
    expect(step2).not.toContain('Reply *YES*');

    // Step 3: Customer enters PIN in the input form (Flow sheet)
    console.log('\n📲 [Step 3] Customer submits PIN in input field:');
    const step3 = await assistant.submitTransferPin(PHONE, '1234');
    console.log('\n🤖 [Step 3 Response] Bot sends final result:');
    console.log(step3);
    expect(step3).toContain('Simulated Transfer Successful!');
  });
});
