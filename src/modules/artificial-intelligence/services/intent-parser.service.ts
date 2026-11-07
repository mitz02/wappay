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
  ADD_CONTACT = 'ADD_CONTACT',
  DELETE_CONTACT = 'DELETE_CONTACT',
  EDIT_CONTACT = 'EDIT_CONTACT',
  GIFTING = 'GIFTING',
  REGISTER = 'REGISTER',
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
  transfers?: Array<{ amountKobo: bigint; recipient: string }>;
  network?: string;
  plan?: string;
  hasExplicitPlan?: boolean;
  limit?: number;
  reference?: string;
  confirmationWord?: string;
  editField?: 'alias' | 'name' | 'accountNumber';
  newValue?: string;
  contactName?: string;
  accountNumber?: string;
  bankName?: string;
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

    // 3. Gift Shop — checked before deposit/airtime so "send a gift" opens the catalog
    if (
      /\bgifts?\b/i.test(lower) ||
      /\bgifting\b/i.test(lower) ||
      lower.includes('gift shop') ||
      lower.includes('gift card')
    ) {
      return {
        intent: MockFinancialIntent.GIFTING,
        confidence: 0.96,
        rawText: raw,
      };
    }

    // 3b. Registration — before deposit/balance so "register" never falls through to GENERAL
    if (
      /^(?:register|registration|sign\s*up|signup|create\s*(?:an?\s*)?account|open\s*(?:an?\s*)?account|i\s*want\s*to\s*register|want\s*to\s*register|how\s*to\s*register|register\s*me)$/i.test(
        lower,
      ) ||
      lower.includes('i want to register') ||
      lower.includes('want to register') ||
      lower.includes('sign up') ||
      lower.includes('create account') ||
      lower.includes('open account')
    ) {
      return {
        intent: MockFinancialIntent.REGISTER,
        confidence: 0.97,
        rawText: raw,
      };
    }

    // 4. Deposit — checked BEFORE balance enquiry to prevent "top up balance" being routed
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

    // 5. Edit Contact / Recipient — checked BEFORE listing so "edit contact mum"
    //    never falls through to the contacts list.
    const editContact = this.parseEditContact(raw, lower);
    if (editContact) {
      return editContact;
    }

    // 5a. Delete Contact — before listing so "delete contact mum" is never
    //     mistaken for a contact-list request.
    const deleteContact = this.parseDeleteContact(raw, lower);
    if (deleteContact) {
      return deleteContact;
    }

    // 5b. Add Contact — before listing/balance so "add contact …" is never
    //     swallowed by other keyword rules.
    const addContact = this.parseAddContact(raw, lower);
    if (addContact) {
      return addContact;
    }

    // 5c. Saved Recipients Listing (contacts)
    if (
      lower.includes('saved recipients') ||
      lower.includes('my recipients') ||
      lower.includes('saved contacts') ||
      lower.includes('my contacts') ||
      lower.includes('show contacts') ||
      lower.includes('show my contacts') ||
      lower.includes('list contacts') ||
      lower.includes('contact list') ||
      lower.includes('contacts list') ||
      lower.includes('beneficiaries') ||
      lower.includes('who are my saved') ||
      lower.includes('who are my contacts') ||
      lower === 'contacts' ||
      lower === 'contact'
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
    if (
      lower.includes('airtime') ||
      lower.includes('recharge phone') ||
      lower.includes('buy credit') ||
      lower === 'recharge' ||
      lower.startsWith('recharge ') ||
      lower === 'airtime' ||
      lower.startsWith('buy airtime') ||
      lower === 'top up' ||
      lower.startsWith('top up phone') ||
      lower.startsWith('top up airtime') ||
      lower === 'credit'
    ) {
      const amountKobo = this.extractMonetaryAmount(raw);
      const network = this.extractNetwork(raw);
      // Default to MTN when an amount is present but no network is specified.
      // When no amount is provided (bare "buy airtime"), leave network undefined so
      // the interactive wizard starts at network selection.
      const resolvedNetwork = network || (amountKobo ? 'MTN' : undefined);
      return {
        intent: MockFinancialIntent.AIRTIME_PURCHASE,
        confidence: 0.94,
        amountKobo,
        network: resolvedNetwork,
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
      const hasExplicitPlan = Boolean(plan);
      return {
        intent: MockFinancialIntent.DATA_PURCHASE,
        confidence: 0.94,
        amountKobo,
        network: network || (hasExplicitPlan ? 'MTN' : undefined),
        plan: plan || '2GB',
        hasExplicitPlan,
        rawText: raw,
      };
    }

    // 10. Fund Transfer (Send / Transfer)
    // The regex skips an optional currency word ("naira", "NGN") between amount and "to <recipient>".
    // Examples:
    //   "Send 5000 naira to Mum"  → amount=5000 NGN, recipient="Mum"
    //   "Transfer 10k to John"    → amount=10,000 NGN, recipient="John"
    //   "Send ₦2,500 to Jane"     → amount=₦2,500, recipient="Jane"
    // Multi-transfer check: e.g. "send 1000 to mum and 500 to sister"
    const transferClauses = raw.split(/\s*(?:and|&|,|\+)\s+/i);
    if (transferClauses.length > 1) {
      const parsedTransfers: Array<{ amountKobo: bigint; recipient: string }> = [];
      for (const clause of transferClauses) {
        const m = clause.match(/(?:(?:send|transfer|pay)\s+)?(?:(?:ngn|₦)\s*)?([0-9kK,.]+)\s*(?:naira\s*)?(?:to\s+)([a-zA-Z0-9_]+)/i);
        if (m) {
          const aStr = m[1].replace(/,/g, '');
          let kobo: bigint | undefined;
          try {
            if (aStr.toLowerCase().endsWith('k')) {
              kobo = parseNairaToKobo(parseFloat(aStr.slice(0, -1)) * 1000);
            } else {
              kobo = parseNairaToKobo(aStr);
            }
          } catch {
            kobo = undefined;
          }
          if (kobo && kobo > 0n) {
            parsedTransfers.push({ amountKobo: kobo, recipient: m[2].trim() });
          }
        }
      }

      if (parsedTransfers.length > 1) {
        return {
          intent: MockFinancialIntent.TRANSFER,
          confidence: 0.98,
          transfers: parsedTransfers,
          amountKobo: parsedTransfers[0].amountKobo,
          recipient: parsedTransfers[0].recipient,
          rawText: raw,
        };
      }
    }

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

  /**
   * Parses contact/recipient edit commands, e.g.:
   *   "edit contact mum"                     → target=mum, no value yet
   *   "rename mum to mother"                 → target=mum, field=alias, value=mother
   *   "edit contact mum to mother"           → target=mum, field=alias, value=mother
   *   "change name of mum to Jane Okafor"    → target=mum, field=name, value=Jane Okafor
   *   "update contact mum account number to 0123456789"
   */
  private parseEditContact(
    raw: string,
    lower: string,
  ): ParsedFinancialIntent | undefined {
    const verbMatch = lower.match(/^(?:please\s+)?(edit|update|change|rename|modify)\b\s*/);
    if (!verbMatch) return undefined;

    const verb = verbMatch[1];
    const rest = raw.slice(verbMatch[0].length);
    const restLower = rest.toLowerCase();

    const mentionsSubject =
      /\b(?:contact|contacts|recipient|recipients|beneficiary|beneficiaries|alias)\b/.test(
        restLower,
      );
    const mentionsField = /\b(?:name|alias|account\s*(?:number|no\b|#)|acct)\b/.test(
      restLower,
    );
    // "rename X to Y" is unambiguous even without the word "contact";
    // "change name of mum to Jane" is too, thanks to the explicit field keyword.
    if (!mentionsSubject && verb !== 'rename' && !mentionsField) return undefined;

    // Field detection — only meaningful once a value is present.
    let field: 'alias' | 'name' | 'accountNumber' = 'alias';
    if (/\b(?:account\s*(?:number|no\b|#)|acct(?:\s*(?:number|no\b))?)\b/.test(lower)) {
      field = 'accountNumber';
    } else if (/\b(?:full\s+name|account\s+name|contact\s+name|display\s+name)\b/.test(lower)) {
      field = 'name';
    } else if (/\bname\b/.test(lower)) {
      field = 'name';
    } else if (/\balias\b/.test(lower)) {
      field = 'alias';
    }

    // Split "<target> to <value>" on the first standalone "to".
    let targetPart = rest;
    let newValue: string | undefined;
    const toIdx = restLower.search(/\s+to\s+/);
    if (toIdx >= 0) {
      targetPart = rest.slice(0, toIdx);
      newValue = rest
        .slice(toIdx)
        .replace(/^\s+to\s+/i, '')
        .trim();
      if (newValue) {
        newValue = newValue.replace(
          /^(?:alias|name|account\s*(?:number|no\b)?)\s+/i,
          '',
        );
      }
    }

    const noiseWords =
      /\b(?:contact|contacts|recipient|recipients|beneficiary|beneficiaries|alias|name|full\s+name|account\s+name|contact\s+name|display\s+name|account\s*(?:number|no\b|#)?|acct(?:\s*(?:number|no\b))?|of|the|my|please)\b/gi;
    const recipient = targetPart
      .replace(/[:,]/g, ' ')
      .replace(noiseWords, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      intent: MockFinancialIntent.EDIT_CONTACT,
      confidence: 0.95,
      recipient: recipient || undefined,
      editField: field,
      newValue: newValue || undefined,
      rawText: raw,
    };
  }

  /**
   * Parses contact deletion commands, e.g.:
   *   "delete contact mum"      → recipient=mum
   *   "remove beneficiary john" → recipient=john
   *   "delete my contact"       → recipient=undefined (assistant asks who)
   */
  private parseDeleteContact(
    raw: string,
    lower: string,
  ): ParsedFinancialIntent | undefined {
    const match = lower.match(
      /^(?:please\s+)?(?:delete|remove|clear|erase)\b\s*/,
    );
    if (!match) return undefined;

    const restLower = lower.slice(match[0].length);
    const mentionsSubject =
      /\b(?:contact|contacts|recipient|recipients|beneficiary|beneficiaries)\b/.test(
        restLower,
      );
    if (!mentionsSubject) return undefined;

    const noiseWords =
      /\b(?:please|delete|remove|clear|erase|contact|contacts|recipient|recipients|beneficiary|beneficiaries|my|the|saved|from\s+my\s+list|list)\b/g;
    const recipient = raw
      .slice(match[0].length)
      .replace(/[:,]/g, ' ')
      .replace(noiseWords, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      intent: MockFinancialIntent.DELETE_CONTACT,
      confidence: 0.96,
      recipient: recipient || undefined,
      rawText: raw,
    };
  }

  /**
   * Parses contact creation commands, e.g.:
   *   "add contact mum 0123456789 GTB"           → name=mum, account, bank
   *   "save contact Jane as jane"                 → name=Jane, alias=jane
   *   "create a new contact for John"             → name=John (assistant asks for details)
   *   "add beneficiary Chidi 0987654321 Access"   → full details
   */
  private parseAddContact(
    raw: string,
    lower: string,
  ): ParsedFinancialIntent | undefined {
    const match = lower.match(
      /^(?:please\s+)?(?:add|save|create|new|register)\b\s*/,
    );
    if (!match) return undefined;

    const restLower = lower.slice(match[0].length);
    const mentionsSubject =
      /\b(?:contact|contacts|recipient|recipients|beneficiary|beneficiaries)\b/.test(
        restLower,
      );
    // "save 5000 to mum" / "save for later" are not contact commands.
    if (!mentionsSubject) return undefined;

    let rest = raw.slice(match[0].length);

    // Optional "as <alias>" suffix.
    let alias: string | undefined;
    const asIdx = restLower.search(/\s+as\s+/);
    if (asIdx >= 0) {
      alias = rest.slice(asIdx).replace(/^\s+as\s+/i, '').trim().replace(/[.,]$/, '');
      rest = rest.slice(0, asIdx);
    }

    // Strip command/subject noise to recover the remaining tokens.
    const noiseWords =
      /\b(?:please|add|save|create|new|register|a|an|contact|contacts|recipient|recipients|beneficiary|beneficiaries|for|my|the|saved)\b/gi;
    const tokens = rest
      .replace(/[:,]/g, ' ')
      .replace(noiseWords, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    // "<name…> <10-digit account> <bank…>" — the account number splits the
    // contact name from the bank name.
    const accIdx = tokens.findIndex((t) => /^\d{10}$/.test(t));
    const accountNumber = accIdx >= 0 ? tokens[accIdx] : undefined;

    let contactName: string | undefined;
    let bankName: string | undefined;

    if (accIdx >= 0) {
      contactName = tokens.slice(0, accIdx).join(' ') || undefined;
      bankName = tokens.slice(accIdx + 1).join(' ') || undefined;
    } else if (tokens.length > 1 && this.isBankToken(tokens[tokens.length - 1])) {
      // "Jane Adeleke GTB" — a trailing bank word splits the name.
      contactName = tokens.slice(0, -1).join(' ');
      bankName = tokens[tokens.length - 1];
    } else {
      contactName = tokens.join(' ') || undefined;
    }

    if (!contactName && !accountNumber && !alias) return undefined;

    return {
      intent: MockFinancialIntent.ADD_CONTACT,
      confidence: 0.95,
      contactName: contactName || undefined,
      accountNumber,
      bankName,
      recipient: alias || undefined,
      newValue: alias,
      rawText: raw,
    };
  }

  /**
   * True when a token is recognisable as (part of) a bank name.
   */
  private isBankToken(token: string): boolean {
    const bankWords = [
      'gtb',
      'gtbank',
      'access',
      'zenith',
      'uba',
      'first',
      'bank',
      'fidelity',
      'sterling',
      'union',
      'fcmb',
      'polaris',
      'stanbic',
      'wema',
      'unity',
      'keystone',
      'opay',
      'kuda',
      'palmpay',
      'providus',
      'moniepoint',
      'fairmoney',
    ];
    return bankWords.includes(token.toLowerCase());
  }

  private extractMonetaryAmount(text: string): bigint | undefined {    const match = text.match(/(?:ngn|₦)?\s*([0-9kK,.]+)/i);
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
