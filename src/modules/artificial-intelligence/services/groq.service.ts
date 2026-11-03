import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq, { toFile } from 'groq-sdk';
import {
  IChatProvider,
  ChatMessage,
  ChatCompletionOptions,
} from '../../../contracts/ai/ai-provider.contract';
import { AI_CONSTANTS, AI_FALLBACK_RESPONSES } from '../ai.constants';

@Injectable()
export class GroqService implements IChatProvider {
  private readonly logger = new Logger(GroqService.name);
  readonly providerName = 'GROQ_AI_PROVIDER';

  private groqClient: Groq | null = null;
  private readonly configuredModel: string;
  private readonly isSimulated: boolean;

  constructor(private readonly configService: ConfigService) {
    const rawApiKey = this.configService.get<string>('groq.apiKey') || process.env.GROQ_API_KEY || '';
    this.configuredModel =
      this.configService.get<string>('groq.model') ||
      process.env.GROQ_MODEL ||
      AI_CONSTANTS.DEFAULT_GROQ_MODEL;
    this.isSimulated = this.configService.get<boolean>('isSimulated') ?? true;

    if (rawApiKey && !rawApiKey.startsWith('mock_')) {
      // Safe masked log: never print the full API key
      const maskedKey =
        rawApiKey.length > 8 ? `${rawApiKey.slice(0, 4)}...${rawApiKey.slice(-4)}` : '***';
      this.logger.log(
        `Initializing Groq SDK client (Model: ${this.configuredModel}, Key: ${maskedKey})`,
      );
      this.groqClient = new Groq({ apiKey: rawApiKey });
    } else {
      this.logger.log(
        `Groq SDK in sandbox simulation mode (Model: ${this.configuredModel})`,
      );
    }
  }

  /**
   * Generates a conversational chat completion using the official Groq TypeScript SDK.
   *
   * @param messages - Array of conversation messages (system prompt + history + current user message).
   * @param options - Optional override for temperature, maxTokens, and timeout.
   * @returns Clean, validated text response string.
   */
  async generateChatResponse(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('groq.apiKey') || process.env.GROQ_API_KEY || '';
    const model = this.configuredModel;
    const isSimulated = this.isSimulated;

    // 1. Validate Input
    if (!messages || messages.length === 0) {
      this.logger.warn('generateChatResponse called with empty messages array.');
      return AI_FALLBACK_RESPONSES.EMPTY_RESPONSE;
    }

    // 2. Simulated / Offline Sandbox Gate
    if (isSimulated && (!apiKey || apiKey.startsWith('mock_'))) {
      return this.generateSimulatedResponse(messages);
    }

    // 3. Live API Client Check
    const client = this.groqClient || new Groq({ apiKey });

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? AI_CONSTANTS.DEFAULT_TEMPERATURE,
        max_tokens: options?.maxTokens ?? AI_CONSTANTS.DEFAULT_MAX_TOKENS,
      });

      // 4. Validate Model Output (Bank-Grade Validation)
      const validatedText = this.validateCompletionOutput(completion);
      return validatedText;
    } catch (err: unknown) {
      return this.handleGroqError(err);
    }
  }

  /**
   * Transcribes an audio buffer using Groq's high-speed Whisper Large v3 model.
   * If in sandbox or when Groq is unavailable, returns a safe simulated transcription.
   *
   * @param audioBuffer - Binary audio buffer (e.g. ogg, mp3, wav, m4a).
   * @param filename - Optional filename hint (e.g. "voicenote.ogg").
   * @returns Transcribed text content.
   */
  async transcribeAudio(audioBuffer: Buffer, filename = 'voicenote.ogg'): Promise<string> {
    const apiKey = this.configService.get<string>('groq.apiKey') || process.env.GROQ_API_KEY || '';
    const isSimulated = this.isSimulated;

    if (isSimulated && (!apiKey || apiKey.startsWith('mock_'))) {
      this.logger.log(
        `[SIMULATED] Transcribing voice note (${audioBuffer.length} bytes) in sandbox mode`,
      );
      return 'Send 5000 naira to Mum';
    }

    const client = this.groqClient || new Groq({ apiKey });

    try {
      const file = await toFile(audioBuffer, filename);
      const transcription = await client.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3',
        language: 'en',
        response_format: 'json',
      });

      const text = transcription.text?.trim() || '';
      this.logger.log(`Audio transcribed successfully (${text.length} chars)`);
      return text;
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.error(`Groq Whisper transcription failed: ${error.message}`);
      if (isSimulated) {
        return 'Send 5000 naira to Mum';
      }
      throw error;
    }
  }

  /**
   * Validates the structure and content of Groq completion output.
   * Throws or returns safe fallback if the model response is malformed.
   */
  validateCompletionOutput(completion: any): string {
    if (!completion || typeof completion !== 'object') {
      this.logger.error('Groq returned a malformed response: completion is not an object.');
      return AI_FALLBACK_RESPONSES.EMPTY_RESPONSE;
    }

    if (!Array.isArray(completion.choices) || completion.choices.length === 0) {
      this.logger.error('Groq returned no choices in response.');
      return AI_FALLBACK_RESPONSES.EMPTY_RESPONSE;
    }

    const firstChoice = completion.choices[0];
    const rawContent = firstChoice?.message?.content;

    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      this.logger.error('Groq returned empty or non-string message content.');
      return AI_FALLBACK_RESPONSES.EMPTY_RESPONSE;
    }

    return rawContent.trim();
  }

  /**
   * Translates Groq SDK errors into safe, customer-friendly fallback responses
   * while logging masked diagnostic details without leaking credentials.
   */
  private handleGroqError(err: unknown): string {
    const error = err as { name?: string; status?: number; message?: string; code?: string };

    if (error instanceof Groq.AuthenticationError || error.status === 401) {
      this.logger.error(
        'Groq authentication failure: invalid or revoked GROQ_API_KEY. Credentials masked.',
      );
      return AI_FALLBACK_RESPONSES.AUTH_ERROR;
    }

    if (error instanceof Groq.RateLimitError || error.status === 429) {
      this.logger.warn('Groq rate limit exceeded (HTTP 429). Returning safe throttle response.');
      return AI_FALLBACK_RESPONSES.RATE_LIMIT;
    }

    if (error instanceof Groq.APIConnectionTimeoutError) {
      this.logger.warn('Groq API connection timed out. Returning timeout response.');
      return AI_FALLBACK_RESPONSES.TIMEOUT;
    }

    if (error instanceof Groq.NotFoundError || error.status === 404) {
      this.logger.error(`Groq model not found or unavailable: ${this.configuredModel}`);
      return AI_FALLBACK_RESPONSES.ERROR;
    }

    if (error instanceof Groq.InternalServerError || (error.status && error.status >= 500)) {
      this.logger.error(`Groq server error (HTTP ${error.status}): ${error.message}`);
      return AI_FALLBACK_RESPONSES.ERROR;
    }

    this.logger.error(`Unhandled Groq API error: ${error.message}`);
    return AI_FALLBACK_RESPONSES.ERROR;
  }

  /**
   * Generates intelligent, deterministic responses in simulated sandbox environments
   * when no live API key is configured.
   */
  private generateSimulatedResponse(messages: ChatMessage[]): string {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const lower = lastUserMessage.toLowerCase();

    // 1. Clarification for ambiguous queries
    if (lower === 'send money' || lower === 'transfer' || lower === 'buy airtime' || lower === 'send') {
      return (
        `I would be happy to help with that! Could you please clarify:\n` +
        `1. *How much* would you like to send or purchase?\n` +
        `2. *Who* is the recipient (or phone network)?`
      );
    }

    // 2. Greetings
    if (
      lower === 'hi' ||
      lower === 'hello' ||
      lower === 'hey' ||
      lower.startsWith('hello') ||
      lower.startsWith('hi ')
    ) {
      return (
        `👋 *Hello! Welcome to WAPPay.*\n\n` +
        `I am your AI financial assistant on WhatsApp. Here is what I can help you with:\n` +
        `• *Money Transfers:* Send funds to bank accounts or friends\n` +
        `• *Airtime & Data:* Instant mobile top-ups\n` +
        `• *Account Balance:* Check your balance and account details\n` +
        `• *Transaction History:* View recent payments and statements\n\n` +
        `How can I assist you today?`
      );
    }

    // 3. Financial request recognition with strict safety explanation
    if (
      lower.includes('transfer') ||
      lower.includes('send') ||
      lower.includes('pay') ||
      lower.includes('airtime') ||
      lower.includes('balance')
    ) {
      return (
        `I recognize your financial request: *"${lastUserMessage}"*.\n\n` +
        `🔒 *Security Notice:* As your AI assistant, I can understand and organize financial requests, but *I cannot directly move funds or debit your account*.\n\n` +
        `To complete live financial transactions, your account must be verified and you must authorize the transfer using your secret transaction PIN.`
      );
    }

    // 4. Default natural conversational reply
    return (
      `I understand your message: "${lastUserMessage}".\n\n` +
      `WAPPay lets you bank and send money conversationally on WhatsApp. Feel free to ask about our features or how to get started!`
    );
  }
}
