import { ConfigService } from '@nestjs/config';
import { WhatsAppMessageService } from './services/whatsapp-message.service';
import { WhatsAppApiService } from './services/whatsapp-api.service';

describe('WhatsAppMessageService', () => {
  const mockApiResponse = {
    messaging_product: 'whatsapp',
    contacts: [{ input: '2348012345678', wa_id: '2348012345678' }],
    messages: [{ id: 'wamid.OUT_001' }],
  };

  function makeService() {
    const apiService = {
      sendTextMessage: jest.fn().mockResolvedValue(mockApiResponse),
    } as unknown as WhatsAppApiService;
    const configService = { get: jest.fn() } as unknown as ConfigService;
    return {
      service: new WhatsAppMessageService(apiService),
      apiService,
    };
  }

  // -------------------------------------------------------------------------
  // Phone normalization
  // -------------------------------------------------------------------------

  describe('normalizePhoneNumber()', () => {
    it('strips leading + sign', () => {
      const { service } = makeService();
      expect(service.normalizePhoneNumber('+2348012345678')).toBe('2348012345678');
    });

    it('strips spaces and dashes from a formatted number', () => {
      const { service } = makeService();
      expect(service.normalizePhoneNumber('+234 801-234-5678')).toBe('2348012345678');
    });

    it('converts a local Nigerian 080... number to international format', () => {
      const { service } = makeService();
      expect(service.normalizePhoneNumber('08012345678')).toBe('2348012345678');
    });

    it('leaves an already-normalized international number unchanged', () => {
      const { service } = makeService();
      expect(service.normalizePhoneNumber('2348012345678')).toBe('2348012345678');
    });

    it('correctly normalizes a US number', () => {
      const { service } = makeService();
      expect(service.normalizePhoneNumber('+1-202-555-0100')).toBe('12025550100');
    });
  });

  // -------------------------------------------------------------------------
  // sendReply()
  // -------------------------------------------------------------------------

  describe('sendReply()', () => {
    it('delegates to WhatsAppApiService.sendTextMessage with all params', async () => {
      const { service, apiService } = makeService();
      const result = await service.sendReply('2348012345678', 'Hi there', 'wamid.ORIG_001');

      expect(apiService.sendTextMessage).toHaveBeenCalledWith(
        '2348012345678',
        'Hi there',
        'wamid.ORIG_001',
      );
      expect(result.messages[0].id).toBe('wamid.OUT_001');
    });

    it('passes undefined for replyToMessageId when not provided', async () => {
      const { service, apiService } = makeService();
      await service.sendReply('2348012345678', 'Hello');
      expect(apiService.sendTextMessage).toHaveBeenCalledWith(
        '2348012345678',
        'Hello',
        undefined,
      );
    });
  });
});
