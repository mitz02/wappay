import { Injectable, Logger } from '@nestjs/common';
import { parseNairaToKobo } from '../../../common/types';

export enum MockFinancialIntent {
  BALANCE_ENQUIRY = 'BALANCE_ENQUIRY',
  TRANSACTION_HISTORY = 'TRANSACTION_HISTORY',
  TRANSFER = 'TRANSFER',
  AIRTIME_PURCHASE = 'AIRTIME_PURCHASE',
  DATA_PURCHASE = 'DATA_PURCHASE',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  LIST_RECIPIENTS = 'LIST_RECIPIENTS',
  CONFIRM_TRANSACTION = 'CONFIRM_TRANSACTION',
  CANCEL_TRANSACTION = 'CANCEL_TRANSACTION',
  HELP = 'HELP',
  GENERAL = 'GENERAL',
}

export interface ParsedFinancialIntent {
  intent: MockFinancialIntent;
  confidence: number;
  amountKobo?: bigint;
  recipient?: string;
  network?: string;
  plan?: string;
  limit?: number;
  reference?: string;
  confirmationWord?: string;
  rawText: string;
}

@Injectable()
export class IntentParserService {
  private readonly logger = new Logger(IntentParserService.name);

  /**
   * Parses natural language customer messages into structured financial intents & entities.
   */
  async parseIntent(text: string): Promise<ParsedFinancialIntent> {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1. Transaction Confirmation
    const confirmRegex = /^(?:yes|confirm|proceed|ok|y|yep|sure|approve)$/i;
    if (confirmRegex.test(lower) || /^\d{4}$/.test(lower)) {
      return {
        intent: MockFinancialIntent.CONFIRM_TRANSACTION,
        confidence: 0.99,
        confirmationWord: raw,
        rawText: raw,
      };
    }

    // 2. Transaction Cancellation
    const cancelRegex = /^(?:cancel|abort|no|stop|decline|cancel transfer|cancel my pending transfer)$/i;
    if (cancelRegex.test(lower)) {
      return {
        intent: MockFinancialIntent.CANCEL_TRANSACTION,
        confidence: 0.99,
        rawText: raw,
      };
    }

    // 3. Deposit — checked BEFORE balance enquiry to prevent "top up balance" being routed
    //    to BALANCE_ENQUIRY because it contains the word "balance".
    if (lower.startsWith('deposit') || lower.includes('fund account') || lower.includes('top up balance')) {
      const amountKobo = this.extractMonetaryAmount(raw);
      return {
        intent: MockFinancialIntent.DEPOSIT,
        confidence: 0.95,
        amountKobo,
        rawText: raw,
      };
    }

    // 4. Balance Enquiry
    if (
      lower === 'balance' ||
      lower.includes('how much do i have') ||
      lower.includes('how much money do i have') ||
      lower.includes('what is my balance') ||
      lower.includes("what's my balance") ||
      lower.includes('account balance') ||
      lower.includes('check balance') ||
      lower.includes('check my balance') ||
      (lower.includes('balance') && !lower.includes('top up') && !lower.includes('fund'))
    ) {
      return {
        intent: MockFinancialIntent.BALANCE_ENQUIRY,
        confidence: 0.98,
        rawText: raw,
      };
    }

    // 5. Saved Recipients Listing
    if (
      lower.includes('saved recipients') ||
      lower.includes('my recipients') ||
      lower.includes('saved contacts') ||
      lower.includes('beneficiaries') ||
      lower.includes('who are my saved')
    ) {
      return {
        intent: MockFinancialIntent.LIST_RECIPIENTS,
        confidence: 0.95,
        rawText: raw,
      };
    }

    // 6. Transaction History
    // Matches: "history", "statement", "last X transactions", "recent transactions",
    //          or any verb + "transactions" pattern.
    const historyKeywords =
      lower.includes('history') ||
      lower.includes('statement') ||
      lower.includes('last transactions') ||
      lower.includes('recent transactions') ||
      lower.includes('last transaction') ||
      /(?:show|see|get|view|list)\s+(?:my\s+)?(?:last\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?transactions?/i.test(lower);

    if (historyKeywords) {
      let limit = 5;
      const countMatch = lower.match(
        /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b(?=\s+(?:recent\s+)?transactions?)/i,
      );
      if (countMatch) {
        const wordNumbers: Record<string, number> = {
          one: 1,
          two: 2,
          three: 3,
          four: 4,
          five: 5,
          six: 6,
          seven: 7,
          eight: 8,
          nine: 9,
          ten: 10,
        };
        const token = countMatch[1].toLowerCase();
        limit = /^\d+$/.test(token) ? parseInt(token, 10) : wordNumbers[token];
      } else if (lower.includes('last transaction')) {
        limit = 1;
      }
      return {
        intent: MockFinancialIntent.TRANSACTION_HISTORY,
        confidence: 0.96,
        limit,
        rawText: raw,
      };
    }

    // 7. Withdrawal (Simulated cashout)
    if (lower.startsWith('withdraw') || lower.includes('cash out')) {
      const amountKobo = this.extractMonetaryAmount(raw);
      return {
        intent: MockFinancialIntent.WITHDRAWAL,
        confidence: 0.95,
        amountKobo,
        rawText: raw,
      };
    }

    // 8. Airtime Purchase
    if (lower.includes('airtime') || lower.includes('recharge phone') || lower.includes('buy credit')) {
      const amountKobo = this.extractMonetaryAmount(raw);
      const network = this.extractNetwork(raw);
      return {
        intent: MockFinancialIntent.AIRTIME_PURCHASE,
        confidence: 0.94,
        amountKobo,
        network: network || 'MTN',
        rawText: raw,
      };
    }

    // 9. Data Purchase
    // IMPORTANT: extract the data plan string FIRST, then strip it from the text before
    // calling extractMonetaryAmount — this prevents "2" in "2GB" being parsed as ₦2.
    if (lower.includes('data') || lower.includes('internet') || lower.includes('bundle')) {
      const plan = this.extractDataPlan(raw);
      const textForAmount = plan ? raw.replace(new RegExp(plan.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '') : raw;
      const amountKobo = this.extractMonetaryAmount(textForAmount) || 100_000n; // Default ₦1,000
      const network = this.extractNetwork(raw);
      return {
        intent: MockFinancialIntent.DATA_PURCHASE,
        confidence: 0.94,
        amountKobo,
        network: network || 'MTN',
        plan: plan || '2GB',
        rawText: raw,
      };
    }

    // 10. Fund Transfer (Send / Transfer)
    // The regex skips an optional currency word ("naira", "NGN") between amount and "to <recipient>".
    // Examples:
    //   "Send 5000 naira to Mum"  → amount=5000 NGN, recipient="Mum"
    //   "Transfer 10k to John"    → amount=10,000 NGN, recipient="John"
    //   "Send ₦2,500 to Jane"     → amount=₦2,500, recipient="Jane"
    const transferRegex =
      /(?:send|transfer|pay)\s+(?:(?:ngn|₦)\s*)?([0-9kK,.]+)\s+(?:naira\s+)?(?:to\s+)?([a-zA-Z0-9_\s]+)/i;
    const transferMatch = raw.match(transferRegex);

    if (transferMatch) {
      const amountStr = transferMatch[1].replace(/,/g, '');
      const recipient = transferMatch[2].trim().replace(/^to\s+/i, '');
      let amountKobo: bigint | undefined;

      try {
        if (amountStr.toLowerCase().endsWith('k')) {
          const num = parseFloat(amountStr.slice(0, -1));
          amountKobo = parseNairaToKobo(num * 1000);
        } else {
          amountKobo = parseNairaToKobo(amountStr);
        }
      } catch {
        amountKobo = undefined;
      }

      return {
        intent: MockFinancialIntent.TRANSFER,
        confidence: 0.96,
        amountKobo,
        recipient,
        rawText: raw,
      };
    }

    // Transfer keyword alone without amount or recipient (ambiguous)
    if (lower === 'send money' || lower === 'transfer' || lower === 'send') {
      return {
        intent: MockFinancialIntent.TRANSFER,
        confidence: 0.8,
        rawText: raw,
      };
    }

    // 11. General Greetings & Help
    if (
      lower === 'hi' ||
      lower === 'hello' ||
      lower === 'hey' ||
      lower.startsWith('hello') ||
      lower.startsWith('hi ') ||
      lower.includes('what can you do') ||
      lower.includes('help')
    ) {
      return {
        intent: MockFinancialIntent.HELP,
        confidence: 0.99,
        rawText: raw,
      };
    }

    return {
      intent: MockFinancialIntent.GENERAL,
      confidence: 0.5,
      rawText: raw,
    };
  }

  // ---------------------------------------------------------------------------
  // Entity Extractors
  // ---------------------------------------------------------------------------

  private extractMonetaryAmount(text: string): bigint | undefined {
    const match = text.match(/(?:ngn|₦)?\s*([0-9kK,.]+)/i);
    if (!match) return undefined;

    const raw = match[1].replace(/,/g, '');
    try {
      if (raw.toLowerCase().endsWith('k')) {
        const num = parseFloat(raw.slice(0, -1));
        return parseNairaToKobo(num * 1000);
      }
      return parseNairaToKobo(raw);
    } catch {
      return undefined;
    }
  }

  private extractNetwork(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes('mtn')) return 'MTN';
    if (lower.includes('airtel')) return 'AIRTEL';
    if (lower.includes('glo') || lower.includes('globacom')) return 'GLO';
    if (lower.includes('9mobile') || lower.includes('etisalat')) return '9MOBILE';
    return undefined;
  }

  private extractDataPlan(text: string): string | undefined {
    const match = text.match(/([0-9]+(?:\.[0-9]+)?\s*(?:gb|mb))/i);
    if (match) {
      return match[1].toUpperCase().replace(/\s+/g, '');
    }
    return undefined;
  }
}
