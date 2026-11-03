import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WhatsAppSignatureService {
  private readonly logger = new Logger(WhatsAppSignatureService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Verifies the Meta X-Hub-Signature-256 header against the exact raw request bytes.
   *
   * @param rawBody - The unparsed request body Buffer.
   * @param signatureHeader - The 'x-hub-signature-256' header value (e.g. "sha256=abcdef...").
   * @returns boolean - True if the signature is valid; false otherwise.
   */
  verifySignature(rawBody: Buffer | string | undefined, signatureHeader?: string): boolean {
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      this.logger.warn('Webhook rejected: Missing or malformed X-Hub-Signature-256 header.');
      return false;
    }

    if (!rawBody) {
      this.logger.warn('Webhook rejected: Empty or missing raw request body for signature verification.');
      return false;
    }

    const appSecret = this.configService.get<string>('whatsapp.appSecret');
    if (!appSecret) {
      this.logger.error('CRITICAL: WHATSAPP_APP_SECRET is not configured. Webhook signature cannot be verified.');
      return false;
    }

    const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(buffer)
      .digest('hex')}`;

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const receivedBuffer = Buffer.from(signatureHeader, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (err: any) {
      this.logger.error(`Signature verification failed with internal error: ${err.message}`);
      return false;
    }
  }
}
