import { Injectable, Logger } from '@nestjs/common';
import { IAIProvider, FinancialIntent, ParsedIntentProposal } from '../../contracts/ai/ai-provider.contract';
import { parseNairaToKobo } from '../../common/types';

@Injectable()
export class AIService implements IAIProvider {
  private readonly logger = new Logger(AIService.name);
  readonly providerName = 'SANDBOX_AI_ENGINE';

  /**
   * Strictly extracts structured intent proposal from natural language input.
   * AI output is ALWAYS treated as an untrusted proposal.
   */
  async extractIntent(text: string): Promise<ParsedIntentProposal> {
    const raw = text.trim();
    const groqProposal = await this.extractWithGroq(raw);
    if (groqProposal) return groqProposal;

    const lower = raw.toLowerCase();

    // 1. Balance and account queries
    if (lower.includes('balance') || lower.includes('how much') || lower.includes('account balance')) {
      return {
        intent: FinancialIntent.CHECK_BALANCE,
        confidence: 0.98,
        rawText: raw,
        missingFields: [],
      };
    }

    if (lower.includes('account details') || lower.includes('account information')) {
      return { intent: FinancialIntent.CHECK_BALANCE, confidence: 0.96, rawText: raw, missingFields: [] };
    }

    if (lower.includes('recipient') || lower.includes('beneficiar')) {
      return { intent: FinancialIntent.HELP, confidence: 0.94, rawText: raw, missingFields: [] };
    }

    // 2. Transaction History Queries
    if (lower.includes('history') || lower.includes('statement') || lower.includes('last transaction') || lower.includes('recent')) {
      return {
        intent: FinancialIntent.TRANSACTION_HISTORY,
        confidence: 0.95,
        rawText: raw,
        missingFields: [],
      };
    }

    // 3. Data bundle purchases
    if (lower.includes('data') || /\b[0-9]+\s*(gb|mb)\b/i.test(raw)) {
      const bundle = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*(gb|mb)/i);
      return {
        intent: FinancialIntent.BUY_DATA,
        confidence: 0.94,
        bundle: bundle ? `${bundle[1]}${bundle[2].toUpperCase()}` : undefined,
        rawText: raw,
        missingFields: bundle ? [] : ['bundle'],
      };
    }

    // 4. Airtime purchases
    if (lower.includes('airtime') || lower.includes('recharge')) {
      const amount = this.extractMonetaryAmount(raw);
      return {
        intent: FinancialIntent.BUY_AIRTIME,
        confidence: 0.92,
        amountKobo: amount,
        rawText: raw,
        missingFields: amount ? [] : ['amount'],
      };
    }

    // 5. Cash withdrawal
    if (lower.includes('withdraw') || lower.includes('cash out')) {
      const amount = this.extractMonetaryAmount(raw);
      return { intent: FinancialIntent.WITHDRAW_CASH, confidence: 0.9, amountKobo: amount, rawText: raw, missingFields: amount ? [] : ['amount'] };
    }

    // 6. Fund transfers
    // Matches "send 2000 to mum", "transfer 5k to john", "send ₦5,000 to Jane"
    const transferRegex = /(?:send|transfer|pay)\s+(?:(?:ngn|₦)\s*)?([0-9kK,.]+)\s+(?:to\s+)?([a-zA-Z0-9_\s]+)/i;
    const match = raw.match(transferRegex);

    if (match) {
      const amountStr = match[1].replace(/,/g, '');
      const recipientAlias = match[2].trim().replace(/^to\s+/i, '');

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

      const missing: string[] = [];
      if (!amountKobo) missing.push('amount');
      if (!recipientAlias) missing.push('recipient');

      return {
        intent: FinancialIntent.TRANSFER,
        confidence: 0.96,
        amountKobo,
        recipientAlias,
        rawText: raw,
        missingFields: missing,
      };
    }

    // 5. Help and general conversation
    if (lower === 'help' || lower === 'hi' || lower === 'hello' || lower === 'start' || lower.includes('what can you do') || lower.includes('how does this service work')) {
      return {
        intent: FinancialIntent.HELP,
        confidence: 0.99,
        rawText: raw,
        missingFields: [],
      };
    }

    return {
      intent: FinancialIntent.UNKNOWN,
      confidence: 0.3,
      rawText: raw,
      missingFields: [],
    };
  }

  private async extractWithGroq(text: string): Promise<ParsedIntentProposal | undefined> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return undefined;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `Return JSON only: {"intent":"TRANSFER|CHECK_BALANCE|TRANSACTION_HISTORY|BUY_AIRTIME|BUY_DATA|WITHDRAW_CASH|HELP|UNKNOWN","amountNaira":number|null,"recipientAlias":string|null,"bundle":string|null,"missingFields":string[]}. Never execute transactions or invent balances.` },
            { role: 'user', content: text },
          ],
        }),
      });
      if (!response.ok) return undefined;
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
      const amountKobo = typeof parsed.amountNaira === 'number' && Number.isFinite(parsed.amountNaira)
        ? parseNairaToKobo(parsed.amountNaira)
        : undefined;
      const intent = Object.values(FinancialIntent).includes(parsed.intent) ? parsed.intent : FinancialIntent.UNKNOWN;
      return { intent, confidence: 0.8, amountKobo, recipientAlias: parsed.recipientAlias || undefined, bundle: parsed.bundle || undefined, rawText: text, missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields : [] };
    } catch (error) {
      this.logger.warn(`Groq intent extraction failed; using deterministic fallback: ${error instanceof Error ? error.message : 'unknown error'}`);
      return undefined;
    }
  }

  /**
   * Simulated speech-to-text transcription engine.
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    this.logger.log(`[AI] Transcribing voice note of length: ${audioBuffer.length} bytes`);
    // In sandbox, simulates transcription of voice audio
    return 'Send 5000 to Mum';
  }

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
}
