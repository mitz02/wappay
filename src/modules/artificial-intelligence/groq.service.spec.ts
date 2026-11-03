import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { GroqService } from './services/groq.service';
import { AI_FALLBACK_RESPONSES } from './ai.constants';
import { ChatMessage } from '../../contracts/ai/ai-provider.contract';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(configOverrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'groq.apiKey': 'mock_test_key',
        'groq.model': 'openai/gpt-oss-120b',
    isSimulated: true,
    ...configOverrides,
  };

  const configService = {
    get: jest.fn((key: string) => defaults[key]),
  } as unknown as ConfigService;

  return new GroqService(configService);
}

// ---------------------------------------------------------------------------
// GroqService Spec
// ---------------------------------------------------------------------------

describe('GroqService', () => {
  const sampleMessages: ChatMessage[] = [
    { role: 'system', content: 'You are WAPPay AI.' },
    { role: 'user', content: 'Hello there' },
  ];

  // -------------------------------------------------------------------------
  // 1. Sandbox Simulation Mode
  // -------------------------------------------------------------------------

  describe('Sandbox / Simulated mode', () => {
    it('returns a simulated greeting when customer says hello', async () => {
      const service = makeService({ isSimulated: true, 'groq.apiKey': 'mock_key' });
      const reply = await service.generateChatResponse([
        { role: 'user', content: 'Hello' },
      ]);

      expect(reply).toContain('Welcome to WAPPay');
      expect(reply).toContain('AI financial assistant');
    });

    it('returns a financial safety recognition when customer requests money transfer', async () => {
      const service = makeService({ isSimulated: true, 'groq.apiKey': 'mock_key' });
      const reply = await service.generateChatResponse([
        { role: 'user', content: 'Transfer 5000 to Mum' },
      ]);

      expect(reply).toContain('recognize your financial request');
      expect(reply).toContain('cannot directly move funds');
      expect(reply).toContain('transaction PIN');
    });

    it('returns a clarification prompt when customer request is ambiguous', async () => {
      const service = makeService({ isSimulated: true, 'groq.apiKey': 'mock_key' });
      const reply = await service.generateChatResponse([
        { role: 'user', content: 'send money' },
      ]);

      expect(reply).toContain('clarify');
      expect(reply).toContain('How much');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Live API Connectivity (Mocked Groq SDK Client)
  // -------------------------------------------------------------------------

  describe('Live API Connectivity (Mocked Client)', () => {
    let service: GroqService;
    let mockCreate: jest.Mock;

    beforeEach(() => {
      service = makeService({
        isSimulated: false,
        'groq.apiKey': 'gsk_valid_live_key_12345678',
    'groq.model': 'openai/gpt-oss-120b',
      });

      mockCreate = jest.fn();
      // Inject mock client directly onto instance
      (service as any).groqClient = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };
    });

    it('returns validated model output on successful 200 API completion', async () => {
      mockCreate.mockResolvedValue({
        id: 'chatcmpl-123',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'WAPPay allows you to transfer money securely over WhatsApp.',
            },
          },
        ],
      });

      const result = await service.generateChatResponse(sampleMessages);
      expect(result).toBe('WAPPay allows you to transfer money securely over WhatsApp.');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'openai/gpt-oss-120b',
          messages: expect.any(Array),
        }),
      );
    });

    // -----------------------------------------------------------------------
    // 3. Error Handling: Invalid API Key (HTTP 401)
    // -----------------------------------------------------------------------

    it('returns safe auth error fallback when API key is invalid', async () => {
      const authError = new Groq.AuthenticationError(
        401,
        { error: { message: 'Invalid API Key', type: 'invalid_request_error' } },
        'Invalid API Key',
        new Headers(),
      );
      mockCreate.mockRejectedValue(authError);

      const result = await service.generateChatResponse(sampleMessages);
      expect(result).toBe(AI_FALLBACK_RESPONSES.AUTH_ERROR);
    });

    // -----------------------------------------------------------------------
    // 4. Error Handling: Rate Limit (HTTP 429)
    // -----------------------------------------------------------------------

    it('returns safe rate limit fallback when rate limited', async () => {
      const rateLimitError = new Groq.RateLimitError(
        429,
        { error: { message: 'Rate limit reached', type: 'tokens' } },
        'Rate limit reached',
        new Headers(),
      );
      mockCreate.mockRejectedValue(rateLimitError);

      const result = await service.generateChatResponse(sampleMessages);
      expect(result).toBe(AI_FALLBACK_RESPONSES.RATE_LIMIT);
    });

    // -----------------------------------------------------------------------
    // 5. Error Handling: Timeout (APIConnectionTimeoutError)
    // -----------------------------------------------------------------------

    it('returns safe timeout fallback when API call times out', async () => {
      const timeoutError = new Groq.APIConnectionTimeoutError({ message: 'Request timed out' });
      mockCreate.mockRejectedValue(timeoutError);

      const result = await service.generateChatResponse(sampleMessages);
      expect(result).toBe(AI_FALLBACK_RESPONSES.TIMEOUT);
    });

    // -----------------------------------------------------------------------
    // 6. Error Handling: Unavailable / Missing Model (HTTP 404)
    // -----------------------------------------------------------------------

    it('returns safe error fallback when model is unavailable', async () => {
      const notFoundError = new Groq.NotFoundError(
        404,
        { error: { message: 'Model not found' } },
        'Model not found',
        new Headers(),
      );
      mockCreate.mockRejectedValue(notFoundError);

      const result = await service.generateChatResponse(sampleMessages);
      expect(result).toBe(AI_FALLBACK_RESPONSES.ERROR);
    });

    // -----------------------------------------------------------------------
    // 7. Malformed AI Output Validation
    // -----------------------------------------------------------------------

    it('returns fallback response when completion is null', () => {
      const output = service.validateCompletionOutput(null);
      expect(output).toBe(AI_FALLBACK_RESPONSES.EMPTY_RESPONSE);
    });

    it('returns fallback response when choices array is empty', () => {
      const output = service.validateCompletionOutput({ choices: [] });
      expect(output).toBe(AI_FALLBACK_RESPONSES.EMPTY_RESPONSE);
    });

    it('returns fallback response when message content is missing or empty', () => {
      const output = service.validateCompletionOutput({
        choices: [{ message: { content: '   ' } }],
      });
      expect(output).toBe(AI_FALLBACK_RESPONSES.EMPTY_RESPONSE);
    });

    it('returns fallback response when message content is not a string', () => {
      const output = service.validateCompletionOutput({
        choices: [{ message: { content: 12345 } }],
      });
      expect(output).toBe(AI_FALLBACK_RESPONSES.EMPTY_RESPONSE);
    });

    it('returns trimmed string when valid content is returned', () => {
      const output = service.validateCompletionOutput({
        choices: [{ message: { content: '  Clean response  ' } }],
      });
      expect(output).toBe('Clean response');
    });

    // -----------------------------------------------------------------------
    // 8. Security: Never Expose API Key in Logs or Thrown Responses
    // -----------------------------------------------------------------------

    it('does not leak the raw API key in any fallback response', async () => {
      const secretKey = 'gsk_super_confidential_key_99999';
      const secureService = makeService({
        isSimulated: false,
        'groq.apiKey': secretKey,
      });

      const err = new Error(`Connection failed with key ${secretKey}`);
      (secureService as any).groqClient = {
        chat: { completions: { create: jest.fn().mockRejectedValue(err) } },
      };

      const result = await secureService.generateChatResponse(sampleMessages);
      expect(result).not.toContain(secretKey);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Whisper Audio Transcription
  // -------------------------------------------------------------------------

  describe('transcribeAudio()', () => {
    it('returns simulated transcription in sandbox / mock mode', async () => {
      const service = makeService({ isSimulated: true, 'groq.apiKey': 'mock_key' });
      const text = await service.transcribeAudio(Buffer.from('sample_audio_bytes'));

      expect(text).toBe('Send 5000 naira to Mum');
    });

    it('invokes groq.audio.transcriptions.create with whisper-large-v3 in live mode', async () => {
      const service = makeService({ isSimulated: false, 'groq.apiKey': 'gsk_live_1234' });
      (service as any).groqClient = {
        audio: {
          transcriptions: {
            create: jest.fn().mockResolvedValue({ text: 'Check my account balance' }),
          },
        },
      };

      const text = await service.transcribeAudio(Buffer.from('audio_bytes'), 'note.ogg');
      expect(text).toBe('Check my account balance');
      expect((service as any).groqClient.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'whisper-large-v3',
          language: 'en',
          response_format: 'json',
        }),
      );
    });
  });
});
