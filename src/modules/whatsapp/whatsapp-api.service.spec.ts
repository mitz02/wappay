import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  RequestTimeoutException,
} from '@nestjs/common';
import { WhatsAppApiService } from './services/whatsapp-api.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(configValues: Record<string, unknown>): WhatsAppApiService {
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  return new WhatsAppApiService(configService);
}

function mockFetchResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  });
}

// ---------------------------------------------------------------------------
// WhatsAppApiService
// ---------------------------------------------------------------------------

describe('WhatsAppApiService', () => {
  const baseConfig: Record<string, unknown> = {
    'whatsapp.accessToken': 'mock_dev_token',
    'whatsapp.phoneNumberId': '123456789',
    'whatsapp.apiUrl': 'https://graph.facebook.com/v21.0',
    'whatsapp.apiTimeoutMs': 5000,
    isSimulated: true,
  };

  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Sandbox / simulated mode
  // -------------------------------------------------------------------------

  describe('Sandbox / simulated mode', () => {
    it('returns a simulated response without calling fetch', async () => {
      const service = makeService(baseConfig);
      const fetchSpy = jest.spyOn(global, 'fetch' as any);

      const result = await service.sendTextMessage('2348012345678', 'Hello');

      expect(result.messaging_product).toBe('whatsapp');
      expect(result.messages[0].id).toMatch(/^wamid\.SIMULATED_/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('includes the correct recipient in the simulated response', async () => {
      const service = makeService(baseConfig);
      const result = await service.sendTextMessage('2348012345678', 'Hello');
      expect(result.contacts[0].input).toBe('2348012345678');
    });

    it('simulates delivery when a mock token is wrapped in quotes', async () => {
      const service = makeService({ ...baseConfig, 'whatsapp.accessToken': '"mock_dev_token"' });
      const result = await service.sendTextMessage('2348012345678', 'Hello');
      expect(result.messages[0].id).toMatch(/^wamid\.SIMULATED_/);
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('falls back to simulated delivery on HTTP 401 when IS_SIMULATED=true', async () => {
      (global as any).fetch = mockFetchResponse(
        401,
        { error: { message: 'Session has expired', code: 190 } },
        false,
      );
      const service = makeService({
        ...baseConfig,
        isSimulated: true,
        'whatsapp.accessToken': 'expired_live_token',
      });

      const result = await service.sendTextMessage('2348012345678', 'Hello');
      expect(result.messages[0].id).toMatch(/^wamid\.SIMULATED_/);
    });
  });

  // -------------------------------------------------------------------------
  // Missing credentials
  // -------------------------------------------------------------------------

  describe('Missing credentials', () => {
    it('throws InternalServerErrorException when access token is missing', async () => {
      const service = makeService({ ...baseConfig, 'whatsapp.accessToken': undefined, isSimulated: false });
      await expect(service.sendTextMessage('2348012345678', 'Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException when phone number ID is missing', async () => {
      const service = makeService({
        ...baseConfig,
        'whatsapp.accessToken': 'real_token',
        'whatsapp.phoneNumberId': undefined,
        isSimulated: false,
      });
      await expect(service.sendTextMessage('2348012345678', 'Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe('Input validation', () => {
    it('throws BadRequestException for a phone number that is too short', async () => {
      const service = makeService({ ...baseConfig, isSimulated: false, 'whatsapp.accessToken': 'real' });
      await expect(service.sendTextMessage('123', 'Hello')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a symbol-only phone number', async () => {
      const service = makeService({ ...baseConfig, isSimulated: false, 'whatsapp.accessToken': 'real' });
      await expect(service.sendTextMessage('++--()', 'Hello')).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Live API mode
  // -------------------------------------------------------------------------

  describe('Live API mode', () => {
    const liveConfig = { ...baseConfig, isSimulated: false, 'whatsapp.accessToken': 'real_live_token' };

    it('returns WhatsAppApiResponse on a successful HTTP 200', async () => {
      const successBody = {
        messaging_product: 'whatsapp',
        contacts: [{ input: '2348012345678', wa_id: '2348012345678' }],
        messages: [{ id: 'wamid.ABC123' }],
      };
      (global as any).fetch = mockFetchResponse(200, successBody);

      const service = makeService(liveConfig);
      const result = await service.sendTextMessage('2348012345678', 'Hello');
      expect(result.messages[0].id).toBe('wamid.ABC123');
    });

    it('throws UnauthorizedException on HTTP 401', async () => {
      (global as any).fetch = mockFetchResponse(401, { error: { message: 'Invalid token', code: 190 } }, false);
      const service = makeService(liveConfig);
      await expect(service.sendTextMessage('2348012345678', 'Hello')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('strips quotes, Bearer prefix and whitespace from the access token', async () => {
      const fetchMock = mockFetchResponse(200, {
        messaging_product: 'whatsapp',
        contacts: [{ input: '2348012345678', wa_id: '2348012345678' }],
        messages: [{ id: 'wamid.OK' }],
      });
      (global as any).fetch = fetchMock;

      const service = makeService({
        ...baseConfig,
        isSimulated: false,
        'whatsapp.accessToken': '  "Bearer real_live_token"\n',
      });

      await service.sendTextMessage('2348012345678', 'Hello');

      const init = (fetchMock as jest.Mock).mock.calls[0][1];
      expect(init.headers.Authorization).toBe('Bearer real_live_token');
    });

    it('throws BadRequestException on HTTP 400', async () => {
      (global as any).fetch = mockFetchResponse(400, { error: { message: 'Bad phone', code: 100 } }, false);
      const service = makeService(liveConfig);
      await expect(service.sendTextMessage('2348012345678', 'Hello')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws InternalServerErrorException on HTTP 500', async () => {
      (global as any).fetch = mockFetchResponse(500, {}, false);
      const service = makeService(liveConfig);
      await expect(service.sendTextMessage('2348012345678', 'Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws RequestTimeoutException when the request times out (AbortError)', async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      (global as any).fetch = jest.fn().mockRejectedValue(abortErr);
      const service = makeService(liveConfig);
      await expect(service.sendTextMessage('2348012345678', 'Hello')).rejects.toThrow(
        RequestTimeoutException,
      );
    });

    it('throws InternalServerErrorException on a generic network failure', async () => {
      (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
      const service = makeService(liveConfig);
      await expect(service.sendTextMessage('2348012345678', 'Hello')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('does not include the access token in any thrown exception message', async () => {
      (global as any).fetch = mockFetchResponse(401, { error: { message: 'Invalid token', code: 190 } }, false);
      const service = makeService(liveConfig);
      try {
        await service.sendTextMessage('2348012345678', 'Hello');
      } catch (err: any) {
        expect(err.message).not.toContain('real_live_token');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Media Download
  // ---------------------------------------------------------------------------

  describe('downloadMedia()', () => {
    it('returns simulated media buffer in simulation/mock mode', async () => {
      const service = makeService(baseConfig);
      const result = await service.downloadMedia('mock_media_123');

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.mimeType).toContain('audio/ogg');
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('downloads media via Meta Graph API in live mode', async () => {
      const liveConfig: Record<string, unknown> = {
        'whatsapp.accessToken': 'real_live_token',
        'whatsapp.phoneNumberId': '123456789',
        'whatsapp.apiUrl': 'https://graph.facebook.com/v21.0',
        isSimulated: false,
      };

      const mockBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

      // First fetch: GET /{mediaId} -> metadata
      // Second fetch: GET {url} -> binary content
      (global as any).fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              url: 'https://lookaside.fbsbx.com/media_download',
              mime_type: 'audio/ogg; codecs=opus',
              file_size: 4,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(mockBuffer),
        });

      const service = makeService(liveConfig);
      const result = await service.downloadMedia('live_media_456');

      expect(result.buffer.length).toBe(4);
      expect(result.mimeType).toBe('audio/ogg; codecs=opus');
      expect((global as any).fetch).toHaveBeenCalledTimes(2);
    });

    it('throws InternalServerErrorException when accessToken is missing', async () => {
      const service = makeService({ isSimulated: false });
      await expect(service.downloadMedia('media_no_token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
