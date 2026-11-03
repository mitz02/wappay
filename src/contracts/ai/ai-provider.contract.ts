// Conversational AI Provider Contract

export enum FinancialIntent {
  TRANSFER = 'TRANSFER',
  CHECK_BALANCE = 'CHECK_BALANCE',
  TRANSACTION_HISTORY = 'TRANSACTION_HISTORY',
  BUY_AIRTIME = 'BUY_AIRTIME',
  BUY_DATA = 'BUY_DATA',
  WITHDRAW_CASH = 'WITHDRAW_CASH',
  HELP = 'HELP',
  UNKNOWN = 'UNKNOWN',
}

export interface ParsedIntentProposal {
  intent: FinancialIntent;
  confidence: number;
  amountKobo?: bigint;
  recipientAlias?: string;
  phoneNumber?: string;
  network?: string;
  bundle?: string;
  rawText: string;
  missingFields: string[];
}

export interface IAIProvider {
  readonly providerName: string;
  extractIntent(text: string): Promise<ParsedIntentProposal>;
  transcribeAudio(audioBuffer: Buffer): Promise<string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface IChatProvider {
  readonly providerName: string;
  generateChatResponse(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<string>;
}
