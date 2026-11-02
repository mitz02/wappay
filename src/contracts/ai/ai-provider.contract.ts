// Conversational AI Provider Contract

export enum FinancialIntent {
  TRANSFER = 'TRANSFER',
  CHECK_BALANCE = 'CHECK_BALANCE',
  TRANSACTION_HISTORY = 'TRANSACTION_HISTORY',
  BUY_AIRTIME = 'BUY_AIRTIME',
  BUY_DATA = 'BUY_DATA',
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
