import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsAppSignatureService } from './services/whatsapp-signature.service';
import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVerificationQuery(overrides: Record<string, string> = {}) {
  return {
    'hub.mode': 'subscribe',
    'hub.verify_token': 'test-verify-token',
    'hub.challenge': 'challenge-nonce-abc123',
    ...overrides,
  };
}

function makeController(token?: string, hasExplicitToken = false) {
  const resolvedToken = hasExplicitToken ? token : (token ?? 'test-verify-token');
  const configService = {
    get: jest.fn().mockReturnValue(resolvedToken),
  } as unknown as ConfigService;

  const signatureService = {
    verifySignature: jest.fn().mockReturnValue(true),
  } as unknown as WhatsAppSignatureService;

  const webhookService = {
    processWebhookPayload: jest.fn().mockResolvedValue(undefined),
  } as unknown as WhatsAppWebhookService;

  const controller = new WhatsAppWebhookController(configService, signatureService, webhookService);
  return { controller, configService, signatureService, webhookService };
}

// ---------------------------------------------------------------------------
// WhatsAppWebhookController
// ---------------------------------------------------------------------------

describe('WhatsAppWebhookController', () => {
  // -------------------------------------------------------------------------
  // GET /webhooks/whatsapp — Webhook verification
  // -------------------------------------------------------------------------

  describe('verifyWebhook()', () => {
    it('returns the challenge string when the verification token is valid', () => {
      const { controller } = makeController('test-verify-token');
      const query = buildVerificationQuery();
      const result = controller.verifyWebhook(query);
      expect(result).toBe('challenge-nonce-abc123');
    });

    it('throws ForbiddenException when the token does not match', () => {
      const { controller } = makeController('correct-token');
      const query = buildVerificationQuery({ 'hub.verify_token': 'wrong-token' });
      expect(() => controller.verifyWebhook(query)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when hub.mode is not "subscribe"', () => {
      const { controller } = makeController();
      const query = buildVerificationQuery({ 'hub.mode': 'unsubscribe' });
      expect(() => controller.verifyWebhook(query)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when hub.challenge is missing', () => {
      const { controller } = makeController();
      const query = buildVerificationQuery({ 'hub.challenge': '' });
      expect(() => controller.verifyWebhook(query)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when hub.verify_token is missing', () => {
      const { controller } = makeController();
      const query = buildVerificationQuery({ 'hub.verify_token': '' });
      expect(() => controller.verifyWebhook(query)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when WHATSAPP_VERIFY_TOKEN is not configured', () => {
      const { controller } = makeController(undefined, true);
      const query = buildVerificationQuery();
      expect(() => controller.verifyWebhook(query)).toThrow(ForbiddenException);
    });

    it('does not expose the configured verify token in any exception message', () => {
      const { controller } = makeController('super-secret-token');
      const query = buildVerificationQuery({ 'hub.verify_token': 'wrong' });
      try {
        controller.verifyWebhook(query);
      } catch (err: any) {
        expect(err.message).not.toContain('super-secret-token');
      }
    });
  });

  // -------------------------------------------------------------------------
  // POST /webhooks/whatsapp — Inbound webhook processing
  // -------------------------------------------------------------------------

  describe('handleWebhook()', () => {
    const validPayload = {
      object: 'whatsapp_business_account',
      entry: [],
    } as any;

    const mockRequest = {
      rawBody: Buffer.from('{}'),
    } as any;

    it('returns EVENT_RECEIVED for a valid signed request', async () => {
      const { controller } = makeController();
      const result = await controller.handleWebhook(validPayload, 'sha256=validsig', mockRequest);
      expect(result).toEqual({ status: 'EVENT_RECEIVED' });
    });

    it('throws ForbiddenException when the signature is invalid', async () => {
      const { controller, signatureService } = makeController();
      (signatureService.verifySignature as jest.Mock).mockReturnValue(false);
      await expect(
        controller.handleWebhook(validPayload, 'sha256=badsig', mockRequest),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the signature header is missing', async () => {
      const { controller, signatureService } = makeController();
      (signatureService.verifySignature as jest.Mock).mockReturnValue(false);
      await expect(
        controller.handleWebhook(validPayload, undefined, mockRequest),
      ).rejects.toThrow(ForbiddenException);
    });

    it('acknowledges non-whatsapp_business_account objects without processing', async () => {
      const { controller, webhookService } = makeController();
      const unknownPayload = { object: 'page', entry: [] } as any;
      const result = await controller.handleWebhook(unknownPayload, 'sha256=validsig', mockRequest);
      expect(result).toEqual({ status: 'EVENT_RECEIVED' });
      expect(webhookService.processWebhookPayload).not.toHaveBeenCalled();
    });

    it('still returns EVENT_RECEIVED even if the service throws an internal error', async () => {
      const { controller, webhookService } = makeController();
      (webhookService.processWebhookPayload as jest.Mock).mockRejectedValue(new Error('DB failure'));
      const result = await controller.handleWebhook(validPayload, 'sha256=validsig', mockRequest);
      expect(result).toEqual({ status: 'EVENT_RECEIVED' });
    });
  });
});
