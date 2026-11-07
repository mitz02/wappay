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
  /**
   * Sends an interactive button reply message.
   * Optional image header via `headerImageUrl` (network logos, banners).
   */
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string,
    replyToMessageId?: string,
    headerImageUrl?: string,
  ): Promise<WhatsAppApiResponse> {
    return await this.apiService.sendInteractiveButtons(
      to,
      bodyText,
      buttons,
      headerText,
      footerText,
      replyToMessageId,
      headerImageUrl,
    );
  }

  /**
   * Sends an image message (public HTTPS URL) optionally captioned.
   */
  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string,
    replyToMessageId?: string,
  ): Promise<WhatsAppApiResponse> {
    return await this.apiService.sendImageMessage(
      to,
      imageUrl,
      caption,
      replyToMessageId,
    );
  }

  /** Absolute public URL for a /media/networks/ asset. */
  getNetworkMediaUrl(fileName: string): string {
    return this.apiService.getNetworkMediaUrl(fileName);
  }

  /**
   * Sends an interactive list reply message.
   */
  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText?: string,
    replyToMessageId?: string,
  ): Promise<WhatsAppApiResponse> {
    return await this.apiService.sendInteractiveList(
      to,
      bodyText,
      buttonText,
      sections,
      headerText,
      footerText,
      replyToMessageId,
    );
  }

  /**
   * Sends an interactive WhatsApp Flow message (in-chat form).
   */
  async sendInteractiveFlow(options: {
    to: string;
    flowId: string;
    flowToken: string;
    cta: string;
    body: string;
    header?: string;
    footer?: string;
    startScreen?: string;
    initialData?: Record<string, any>;
    replyToMessageId?: string;
  }): Promise<WhatsAppApiResponse> {
    return await this.apiService.sendInteractiveFlow(options);
  }

  normalizePhoneNumber(phoneNumber: string): string {
    const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');

    // If local Nigerian format (e.g. "08012345678"), convert to international "2348012345678"
    if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
      return `234${digitsOnly.slice(1)}`;
    }

    return digitsOnly;
  }
}
