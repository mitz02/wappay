/**
 * IntentParserService Unit Tests
 *
 * Tests cover all supported financial intents, entity extraction (amounts,
 * recipients, networks, data plans), and edge-case handling.
 *
 * Convention: Plain class instantiation (no @nestjs/testing).
 */

import { IntentParserService, MockFinancialIntent } from './services/intent-parser.service';

describe('IntentParserService', () => {
  let service: IntentParserService;

  beforeEach(() => {
    service = new IntentParserService();
  });

  // ---------------------------------------------------------------------------
  // 1. Balance Enquiry
  // ---------------------------------------------------------------------------

  describe('BALANCE_ENQUIRY intent', () => {
    const inputs = [
      "What's my balance?",
      'Check my account balance',
      'How much do I have',
      'How much money do I have?',
      'what is my balance',
    ];

    it.each(inputs)('recognizes "%s" as BALANCE_ENQUIRY', async (input) => {
      const result = await service.parseIntent(input);
      expect(result.intent).toBe(MockFinancialIntent.BALANCE_ENQUIRY);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Transaction History
  // ---------------------------------------------------------------------------

  describe('TRANSACTION_HISTORY intent', () => {
    it('returns TRANSACTION_HISTORY with default limit 5', async () => {
      const result = await service.parseIntent('Show my transaction history');
      expect(result.intent).toBe(MockFinancialIntent.TRANSACTION_HISTORY);
      expect(result.limit).toBe(5);
    });

    it('returns limit 10 for explicit "last 10"', async () => {
      const result = await service.parseIntent('Show my last 10 transactions');
      expect(result.intent).toBe(MockFinancialIntent.TRANSACTION_HISTORY);
      expect(result.limit).toBe(10);
    });

    it('returns limit 10 for "ten" keyword', async () => {
      const result = await service.parseIntent('Show ten recent transactions');
      expect(result.intent).toBe(MockFinancialIntent.TRANSACTION_HISTORY);
      expect(result.limit).toBe(10);
    });

    it('recognizes "statement" as TRANSACTION_HISTORY', async () => {
      const result = await service.parseIntent('Get my statement');
      expect(result.intent).toBe(MockFinancialIntent.TRANSACTION_HISTORY);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Fund Transfer
  // ---------------------------------------------------------------------------

  describe('TRANSFER intent', () => {
    it('extracts amount and recipient from "Send 5000 naira to Mum"', async () => {
      const result = await service.parseIntent('Send 5000 naira to Mum');
      expect(result.intent).toBe(MockFinancialIntent.TRANSFER);
      expect(result.amountKobo).toBe(500_000n); // 5000 NGN = 500000 kobo
      expect(result.recipient).toBe('Mum');
    });

    it('extracts amount and recipient from "Transfer 10k to John"', async () => {
      const result = await service.parseIntent('Transfer 10k to John');
      expect(result.intent).toBe(MockFinancialIntent.TRANSFER);
      expect(result.amountKobo).toBe(1_000_000n); // 10k NGN = 1000000 kobo
      expect(result.recipient).toBe('John');
    });

    it('extracts recipient from "Send ₦2,500 to Jane"', async () => {
      const result = await service.parseIntent('Send ₦2,500 to Jane');
      expect(result.intent).toBe(MockFinancialIntent.TRANSFER);
      expect(result.amountKobo).toBe(250_000n); // ₦2,500 = 250000 kobo
      expect(result.recipient).toMatch(/Jane/i);
    });

    it('returns TRANSFER with no amount for ambiguous "Send money"', async () => {
      const result = await service.parseIntent('Send money');
      expect(result.intent).toBe(MockFinancialIntent.TRANSFER);
      expect(result.amountKobo).toBeUndefined();
    });

    it('returns TRANSFER with no amount for standalone "transfer"', async () => {
      const result = await service.parseIntent('transfer');
      expect(result.intent).toBe(MockFinancialIntent.TRANSFER);
      expect(result.amountKobo).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Deposit
  // ---------------------------------------------------------------------------

  describe('DEPOSIT intent', () => {
    it('detects "Deposit 50000" as DEPOSIT with correct kobo amount', async () => {
      const result = await service.parseIntent('Deposit 50000');
      expect(result.intent).toBe(MockFinancialIntent.DEPOSIT);
      expect(result.amountKobo).toBe(5_000_000n); // ₦50,000 = 5000000 kobo
    });

    it('detects "Top up balance" as DEPOSIT', async () => {
      const result = await service.parseIntent('top up balance');
      expect(result.intent).toBe(MockFinancialIntent.DEPOSIT);
    });

    it('detects "Fund account" as DEPOSIT', async () => {
      const result = await service.parseIntent('fund account 10000');
      expect(result.intent).toBe(MockFinancialIntent.DEPOSIT);
      expect(result.amountKobo).toBe(1_000_000n);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Withdrawal
  // ---------------------------------------------------------------------------

  describe('WITHDRAWAL intent', () => {
    it('detects "Withdraw 10000" as WITHDRAWAL with correct kobo amount', async () => {
      const result = await service.parseIntent('Withdraw 10000');
      expect(result.intent).toBe(MockFinancialIntent.WITHDRAWAL);
      expect(result.amountKobo).toBe(1_000_000n); // ₦10,000 = 1000000 kobo
    });

    it('detects "cash out 5000" as WITHDRAWAL', async () => {
      const result = await service.parseIntent('cash out 5000');
      expect(result.intent).toBe(MockFinancialIntent.WITHDRAWAL);
      expect(result.amountKobo).toBe(500_000n);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Airtime Purchase
  // ---------------------------------------------------------------------------

  describe('AIRTIME_PURCHASE intent', () => {
    it('detects "Buy ₦1,000 MTN airtime" with network extraction', async () => {
      const result = await service.parseIntent('Buy ₦1,000 MTN airtime');
      expect(result.intent).toBe(MockFinancialIntent.AIRTIME_PURCHASE);
      expect(result.network).toBe('MTN');
      expect(result.amountKobo).toBe(100_000n); // ₦1,000 = 100000 kobo
    });

    it('detects Airtel network in airtime request', async () => {
      const result = await service.parseIntent('Recharge phone with Airtel airtime 500');
      expect(result.intent).toBe(MockFinancialIntent.AIRTIME_PURCHASE);
      expect(result.network).toBe('AIRTEL');
    });

    it('detects Glo network in airtime request', async () => {
      const result = await service.parseIntent('Buy glo airtime 200');
      expect(result.intent).toBe(MockFinancialIntent.AIRTIME_PURCHASE);
      expect(result.network).toBe('GLO');
    });

    it('defaults to MTN when no network specified', async () => {
      const result = await service.parseIntent('Buy 500 airtime');
      expect(result.intent).toBe(MockFinancialIntent.AIRTIME_PURCHASE);
      expect(result.network).toBe('MTN');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Data Purchase
  // ---------------------------------------------------------------------------

  describe('DATA_PURCHASE intent', () => {
    it('detects "Buy 2GB data" with plan extraction', async () => {
      const result = await service.parseIntent('Buy 2GB data');
      expect(result.intent).toBe(MockFinancialIntent.DATA_PURCHASE);
      expect(result.plan).toBe('2GB');
    });

    it('extracts 1.5GB plan from text', async () => {
      const result = await service.parseIntent('Subscribe 1.5GB internet bundle');
      expect(result.intent).toBe(MockFinancialIntent.DATA_PURCHASE);
      expect(result.plan).toBe('1.5GB');
    });

    it('defaults to 2GB plan when none specified', async () => {
      const result = await service.parseIntent('Buy data for MTN');
      expect(result.intent).toBe(MockFinancialIntent.DATA_PURCHASE);
      expect(result.plan).toBe('2GB');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Confirm Transaction
  // ---------------------------------------------------------------------------

  describe('CONFIRM_TRANSACTION intent', () => {
    const confirmInputs = ['YES', 'yes', 'confirm', 'Confirm', 'proceed', 'OK', 'ok', 'y', 'yep', 'sure', 'approve'];

    it.each(confirmInputs)('recognizes "%s" as CONFIRM_TRANSACTION', async (input) => {
      const result = await service.parseIntent(input);
      expect(result.intent).toBe(MockFinancialIntent.CONFIRM_TRANSACTION);
      expect(result.confirmationWord).toBe(input);
    });

    it('recognizes a 4-digit PIN as CONFIRM_TRANSACTION', async () => {
      const result = await service.parseIntent('1234');
      expect(result.intent).toBe(MockFinancialIntent.CONFIRM_TRANSACTION);
      expect(result.confirmationWord).toBe('1234');
    });

    it('does NOT parse "1234567" (7-digit) as a confirmation', async () => {
      const result = await service.parseIntent('1234567');
      expect(result.intent).not.toBe(MockFinancialIntent.CONFIRM_TRANSACTION);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Cancel Transaction
  // ---------------------------------------------------------------------------

  describe('CANCEL_TRANSACTION intent', () => {
    const cancelInputs = ['cancel', 'CANCEL', 'abort', 'no', 'NO', 'stop', 'decline'];

    it.each(cancelInputs)('recognizes "%s" as CANCEL_TRANSACTION', async (input) => {
      const result = await service.parseIntent(input);
      expect(result.intent).toBe(MockFinancialIntent.CANCEL_TRANSACTION);
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Help Intent
  // ---------------------------------------------------------------------------

  describe('HELP intent', () => {
    it('recognizes standalone "help"', async () => {
      const result = await service.parseIntent('help');
      expect(result.intent).toBe(MockFinancialIntent.HELP);
    });

    it('recognizes "what can you do"', async () => {
      const result = await service.parseIntent('What can you do?');
      expect(result.intent).toBe(MockFinancialIntent.HELP);
    });

    it('recognizes "hi" as HELP', async () => {
      const result = await service.parseIntent('hi');
      expect(result.intent).toBe(MockFinancialIntent.HELP);
    });

    it('recognizes "hello" as HELP', async () => {
      const result = await service.parseIntent('hello');
      expect(result.intent).toBe(MockFinancialIntent.HELP);
    });
  });

  // ---------------------------------------------------------------------------
  // 11. List Recipients
  // ---------------------------------------------------------------------------

  describe('LIST_RECIPIENTS intent', () => {
    it('recognizes "Who are my saved recipients?"', async () => {
      const result = await service.parseIntent('Who are my saved recipients?');
      expect(result.intent).toBe(MockFinancialIntent.LIST_RECIPIENTS);
    });

    it('recognizes "Show my beneficiaries"', async () => {
      const result = await service.parseIntent('Show my beneficiaries');
      expect(result.intent).toBe(MockFinancialIntent.LIST_RECIPIENTS);
    });

    it('recognizes "my saved contacts"', async () => {
      const result = await service.parseIntent('my saved contacts');
      expect(result.intent).toBe(MockFinancialIntent.LIST_RECIPIENTS);
    });
  });

  // ---------------------------------------------------------------------------
  // 12. General / Fallback
  // ---------------------------------------------------------------------------

  describe('GENERAL intent (fallback)', () => {
    it('falls back to GENERAL for unrecognized input', async () => {
      const result = await service.parseIntent('What is the weather today?');
      expect(result.intent).toBe(MockFinancialIntent.GENERAL);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('preserves rawText in returned object', async () => {
      const text = 'Some arbitrary message';
      const result = await service.parseIntent(text);
      expect(result.rawText).toBe(text);
    });
  });

  // ---------------------------------------------------------------------------
  // 13. Amount Extraction Edge Cases
  // ---------------------------------------------------------------------------

  describe('Amount extraction edge cases', () => {
    it('correctly converts 5000 NGN to 500000 kobo', async () => {
      const result = await service.parseIntent('Deposit 5000');
      expect(result.amountKobo).toBe(500_000n);
    });

    it('correctly converts 50k to 5000000 kobo', async () => {
      const result = await service.parseIntent('Deposit 50k');
      expect(result.amountKobo).toBe(5_000_000n);
    });

    it('handles comma-formatted amounts like "5,000"', async () => {
      const result = await service.parseIntent('Send 5,000 to Mum');
      expect(result.intent).toBe(MockFinancialIntent.TRANSFER);
      expect(result.amountKobo).toBe(500_000n);
    });
  });
});
