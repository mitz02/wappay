import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppApiService } from './whatsapp-api.service';
import { WhatsAppApiResponse } from '../interfaces/whatsapp-message.interface';

@Injectable()
export class WhatsAppMessageService {
  private readonly logger = new Logger(WhatsAppMessageService.name);

  constructor(private readonly apiService: WhatsAppApiService) {}

  /**
   * Sends a standard text reply to a customer message.
   */
  async sendReply(
    to: string,
    message: string,
    replyToMessageId?: string,
  ): Promise<WhatsAppApiResponse> {
    return await this.apiService.sendTextMessage(to, message, replyToMessageId);
  }

  /**
   * Normalizes an incoming phone number into standard international format without '+' or formatting symbols.
   * Example: "+234 801-234-5678" -> "2348012345678"
   */
  normalizePhoneNumber(phoneNumber: string): string {
    const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');

    // If local Nigerian format (e.g. "08012345678"), convert to international "2348012345678"
    if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
      return `234${digitsOnly.slice(1)}`;
    }

    return digitsOnly;
  }
}
