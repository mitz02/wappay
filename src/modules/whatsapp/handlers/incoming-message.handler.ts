import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WhatsAppMessageService } from '../services/whatsapp-message.service';
import { WhatsAppApiService } from '../services/whatsapp-api.service';
import { VoiceService } from '../../voice/voice.service';
import { WhatsAppMessage } from '../interfaces/whatsapp-message.interface';
import {
  WHATSAPP_MESSAGE_TYPES,
  WHATSAPP_TEST_RESPONSES,
} from '../whatsapp.constants';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AIAssistantService } from '../../artificial-intelligence/services/ai-assistant.service';
import {
  GIFT_CATALOG,
  GIFT_KINDS,
} from '../../gifting/gift.constants';

@Injectable()
export class IncomingMessageHandler {
  private readonly logger = new Logger(IncomingMessageHandler.name);

  constructor(
    private readonly messageService: WhatsAppMessageService,
    private readonly prisma: PrismaService,
    private readonly aiAssistantService: AIAssistantService,
    @Optional() private readonly voiceService?: VoiceService,
    @Optional() private readonly apiService?: WhatsAppApiService,
  ) {}

  /**
   * Processes an incoming WhatsApp message through the conversational AI or voice pipeline.
   *
   * @param message - The parsed WhatsApp message object from Meta webhook.
   * @param contactName - Optional sender name from Meta contact profile.
   * @returns The reply text that was sent, for testability.
   */
  async handleMessage(message: WhatsAppMessage, contactName?: string): Promise<string> {
    const rawSender = message.from;
    const normalizedPhone = this.messageService.normalizePhoneNumber(rawSender);
    const maskedPhone =
      normalizedPhone.length > 6
        ? `${normalizedPhone.slice(0, 3)}***${normalizedPhone.slice(-3)}`
        : '***';

    this.logger.log(
      `Handling incoming WhatsApp message [${message.id}] from ${maskedPhone} (Type: ${message.type})`,
    );

    // 1. Customer Identity Association (Clean Read/Create without authorization assumption)
    await this.ensureCustomerIdentityTracked(normalizedPhone, contactName);

    // 2. Handle Voice / Audio Notes via VoiceService Pipeline
    if (message.type === WHATSAPP_MESSAGE_TYPES.AUDIO || message.type === 'voice') {
      const audioMedia = message.audio || (message as any).voice;
      this.logger.log(
        `Received voice note from ${maskedPhone} (Media ID: ${audioMedia?.id || 'none'})`,
      );

      let replyText: string;
      if (!this.voiceService) {
        replyText =
          '🎙️ *Voice Note Received*\n\nVoice processing is currently unavailable. Please send your message as text.';
      } else if (!audioMedia?.id) {
        replyText =
          '⚠️ Could not process voice note: missing media ID. Please try recording again or send a text message.';
      } else {
        try {
          // Download audio media bytes if apiService is available
          let audioBuffer: Buffer | undefined;
          if (this.apiService) {
            try {
              const media = await this.apiService.downloadMedia(audioMedia.id);
              audioBuffer = media.buffer;
            } catch (err: unknown) {
              this.logger.warn(
                `Media download failed, falling back to simulated audio buffer: ${(err as Error).message}`,
              );
            }
          }

          replyText = await this.voiceService.processVoiceNote({
            mediaId: audioMedia.id,
            audioBuffer,
            senderPhone: normalizedPhone,
            senderName: contactName,
            mimeType: audioMedia.mime_type || (message as any).voice?.mime_type || 'audio/ogg',
          });
        } catch (err: unknown) {
          const error = err as { message?: string };
          this.logger.error(`Voice processing error for ${maskedPhone}: ${error.message}`);
          replyText =
            `⚠️ *Voice Processing Notice*\n\n` +
            `Could not process that voice note (${error.message}). Please try again or send your request as text.`;
        }
      }

      await this.messageService.sendReply(normalizedPhone, replyText, message.id);
      return replyText;
    }

    // 3. Extract text from Text or Interactive messages
    let textBody = '';

    if (message.type === WHATSAPP_MESSAGE_TYPES.TEXT) {
      textBody = message.text?.body?.trim() || '';
    } else if (
      message.type === WHATSAPP_MESSAGE_TYPES.INTERACTIVE ||
      message.type === 'interactive'
    ) {
      const interactive = (message as any).interactive;
      textBody =
        interactive?.button_reply?.id ||
        interactive?.list_reply?.id ||
        interactive?.button_reply?.title ||
        interactive?.list_reply?.title ||
        '';
      this.logger.log(`Received interactive button/list selection from ${maskedPhone}: "${textBody}"`);
    } else {
      this.logger.log(
        `Received non-text message type "${message.type}" from ${maskedPhone}. Sending unsupported type notice.`,
      );
      await this.messageService.sendReply(
        normalizedPhone,
        WHATSAPP_TEST_RESPONSES.UNSUPPORTED_TYPE_REPLY,
        message.id,
      );
      return WHATSAPP_TEST_RESPONSES.UNSUPPORTED_TYPE_REPLY;
    }

    // 4. Process Message via AI Assistant Service (Groq AI)

    this.logger.log(
      `Routing inbound message from ${maskedPhone} to Groq AI Assistant: "${textBody}"`,
    );

    let replyText: string;
    try {
      replyText = await this.aiAssistantService.processCustomerMessage(
        normalizedPhone,
        textBody,
        contactName,
      );
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.error(`AI Assistant processing failure: ${error.message}`);
      replyText = WHATSAPP_TEST_RESPONSES.DEFAULT_WELCOME_REPLY;
    }

    // 5. Dispatch Reply via WhatsApp Cloud API (With interactive buttons/list when applicable)
    try {
      if (replyText.includes('SELECT GIFT')) {
        await this.messageService.sendInteractiveList(
          normalizedPhone,
          'Choose a gift to send to someone special:',
          'Select Gift',
          (['AIRTIME', 'DATA', 'MONEY'] as const).map((kind) => ({
            title: GIFT_KINDS[kind].sectionTitle,
            rows: GIFT_CATALOG.filter((gift) => gift.kind === kind).map(
              (gift) => ({
                id: gift.id,
                title: gift.name,
                description: gift.description,
              }),
            ),
          })),
          '🎁 Gift Shop',
          'WAPPay Instant Banking',
          message.id,
        ).catch(async () => {
          await this.messageService.sendReply(normalizedPhone, replyText, message.id);
        });
      } else if (replyText.includes('SELECT MOBILE NETWORK')) {
        await this.messageService.sendInteractiveList(
          normalizedPhone,
          '⚡ *Instant Airtime Recharge*\nPlease choose your mobile network provider below:',
          'Select Network',
          [
            {
              title: 'Mobile Networks',
              rows: [
                { id: 'MTN', title: '🟡 MTN Nigeria', description: 'Instant 4G/5G • 3% Cashback' },
                { id: 'AIRTEL', title: '🔴 Airtel Nigeria', description: 'Smart Recharge • 3% Cashback' },
                { id: 'GLO', title: '🟢 Glo Nigeria', description: 'Unlimited Berekete • 3% Cashback' },
                { id: '9MOBILE', title: '🟢 9mobile', description: 'Super Fast • 3% Cashback' },
              ],
            },
          ],
          '📱 Airtime Top-Up',
          'WAPPay Instant Banking',
          message.id,
        ).catch(async () => {
          await this.messageService.sendReply(normalizedPhone, replyText, message.id);
        });
      } else if (replyText.includes('SELECT AIRTIME AMOUNT')) {
        await this.messageService.sendInteractiveList(
          normalizedPhone,
          'Choose an airtime recharge package below (or reply with a custom amount):',
          'Select Package',
          [
            {
              title: 'Popular Airtime Packages',
              rows: [
                { id: '500', title: '₦500 Airtime', description: 'Pay ₦485 (Save ₦15)' },
                { id: '1000', title: '₦1,000 Airtime', description: 'Pay ₦970 (Save ₦30)' },
                { id: '2000', title: '₦2,000 Airtime', description: 'Pay ₦1,940 (Save ₦60)' },
                { id: '5000', title: '₦5,000 Airtime', description: 'Pay ₦4,850 (Save ₦150)' },
              ],
            },
          ],
          '⚡ Select Package',
          'WAPPay Instant Banking',
          message.id,
        ).catch(async () => {
          await this.messageService.sendReply(normalizedPhone, replyText, message.id);
        });
      } else {
        await this.messageService.sendReply(normalizedPhone, replyText, message.id);
      }
    } catch {
      await this.messageService.sendReply(normalizedPhone, replyText, message.id);
    }

    return replyText;
  }

  /**
   * Associates incoming WhatsApp identity with customer records without granting financial authorization.
   */
  private async ensureCustomerIdentityTracked(
    normalizedPhone: string,
    contactName?: string,
  ): Promise<void> {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { phoneNumber: normalizedPhone },
        include: { customerProfile: true },
      });

      if (!existingUser) {
        // Create customer record in PENDING_VERIFICATION state.
        // This does NOT grant transaction capability or authorize any financial action.
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const user = await tx.user.create({
            data: {
              phoneNumber: normalizedPhone,
              role: 'CUSTOMER',
              isActive: true,
            },
          });

          await tx.customerProfile.create({
            data: {
              userId: user.id,
              whatsappNumber: normalizedPhone,
              fullName: contactName || 'WhatsApp User',
              status: 'PENDING_VERIFICATION',
            },
          });
        });

        this.logger.log(
          `Initialized unverified customer identity record for ${maskedPhone(normalizedPhone)}`,
        );
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      // Identity association failure should not abort sending a reply.
      this.logger.warn(`Non-blocking customer identity tracking error: ${error.message}`);
    }
  }
}

/** Masks a phone number for safe diagnostic logging. */
function maskedPhone(phone: string): string {
  if (!phone || phone.length <= 6) return '***';
  return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
}
