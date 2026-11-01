import { AIService } from './ai.service';
import { FinancialIntent } from '../../contracts/ai/ai-provider.contract';

describe('AIService Intent & Entity Extraction', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
  });

  it('should parse "Send ₦2,000 to Mum" into a valid TRANSFER proposal', async () => {
    const proposal = await aiService.extractIntent('Send ₦2,000 to Mum');
    expect(proposal.intent).toBe(FinancialIntent.TRANSFER);
    expect(proposal.amountKobo).toBe(200000n);
    expect(proposal.recipientAlias).toBe('Mum');
    expect(proposal.missingFields).toHaveLength(0);
  });

  it('should parse "Transfer 5k to John" with "k" multiplier', async () => {
    const proposal = await aiService.extractIntent('Transfer 5k to John');
    expect(proposal.intent).toBe(FinancialIntent.TRANSFER);
    expect(proposal.amountKobo).toBe(500000n);
    expect(proposal.recipientAlias).toBe('John');
  });

  it('should identify balance check queries', async () => {
    const proposal = await aiService.extractIntent('How much money do I have in my account?');
    expect(proposal.intent).toBe(FinancialIntent.CHECK_BALANCE);
  });

  it('should identify transaction history inquiries', async () => {
    const proposal = await aiService.extractIntent('Show my recent statement');
    expect(proposal.intent).toBe(FinancialIntent.TRANSACTION_HISTORY);
  });
});
