import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { WhatsAppSignatureService } from './services/whatsapp-signature.service';

// ---------------------------------------------------------------------------
// WhatsAppSignatureService
// ---------------------------------------------------------------------------

describe('WhatsAppSignatureService', () => {
  const TEST_SECRET = 'test-app-secret-super-secure-32c';

  function buildSignature(body: Buffer | string, secret: string): string {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    const hash = crypto.createHmac('sha256', secret).update(buf).digest('hex');
    return `sha256=${hash}`;
  }

  function makeService(secret: string | undefined): WhatsAppSignatureService {
    const configService = { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
    return new WhatsAppSignatureService(configService);
  }

  it('returns true for a correctly signed Buffer body', () => {
    const body = Buffer.from('{"test":"payload"}');
    const sig = buildSignature(body, TEST_SECRET);
    expect(makeService(TEST_SECRET).verifySignature(body, sig)).toBe(true);
  });

  it('returns true for a correctly signed string body', () => {
    const body = '{"test":"payload"}';
    const sig = buildSignature(body, TEST_SECRET);
    expect(makeService(TEST_SECRET).verifySignature(body, sig)).toBe(true);
  });

  it('returns false when the body has been tampered with after signing', () => {
    const original = Buffer.from('{"test":"payload"}');
    const sig = buildSignature(original, TEST_SECRET);
    const tampered = Buffer.from('{"test":"TAMPERED"}');
    expect(makeService(TEST_SECRET).verifySignature(tampered, sig)).toBe(false);
  });

  it('returns false when a different secret was used to sign', () => {
    const body = Buffer.from('{"test":"payload"}');
    const sigWithWrongSecret = buildSignature(body, 'wrong-secret');
    expect(makeService(TEST_SECRET).verifySignature(body, sigWithWrongSecret)).toBe(false);
  });

  it('returns false when the signature header is missing', () => {
    const body = Buffer.from('{"test":"payload"}');
    expect(makeService(TEST_SECRET).verifySignature(body, undefined)).toBe(false);
  });

  it('returns false when the signature header does not start with sha256=', () => {
    const body = Buffer.from('{"test":"payload"}');
    expect(makeService(TEST_SECRET).verifySignature(body, 'md5=fakehash')).toBe(false);
  });

  it('returns false when the raw body is undefined', () => {
    const sig = buildSignature('{}', TEST_SECRET);
    expect(makeService(TEST_SECRET).verifySignature(undefined, sig)).toBe(false);
  });

  it('returns true for a correctly signed empty body', () => {
    const emptyBody = Buffer.from('');
    const sig = buildSignature(emptyBody, TEST_SECRET);
    expect(makeService(TEST_SECRET).verifySignature(emptyBody, sig)).toBe(true);
  });

  it('returns false when WHATSAPP_APP_SECRET is not configured', () => {
    const body = Buffer.from('{"test":"payload"}');
    const sig = buildSignature(body, TEST_SECRET);
    expect(makeService(undefined).verifySignature(body, sig)).toBe(false);
  });
});
