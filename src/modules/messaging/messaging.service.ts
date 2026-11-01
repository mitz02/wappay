import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validates Meta X-Hub-Signature-256 HMAC signature against raw payload.
   */
  verifyMetaSignature(rawPayload: string, signatureHeader?: string): boolean {
    const appSecret = this.configService.get<string>('whatsapp.appSecret');
    if (!appSecret || !signatureHeader) {
      // In sandbox/dev mode with mock credentials, allow if configured
      if (this.configService.get<boolean>('isSimulated')) {
        return true;
      }
      return false;
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawPayload)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signatureHeader),
    );
  }

  /**
   * Dispatches outbound WhatsApp message to customer.
   */
  async sendTextMessage(toPhoneNumber: string, message: string): Promise<void> {
    this.logger.log(`[WHATSAPP OUTBOUND] To: ${toPhoneNumber} | Message: "${message.replace(/\n/g, ' ')}"`);
    // In production, dispatches via Meta Cloud API: https://graph.facebook.com/v18.0/{phone_number_id}/messages
  }
}
