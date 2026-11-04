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
import { DATA_PACKAGES } from '../../artificial-intelligence/data.constants';
import { FlowSessionService } from '../../whatsapp-flows/services/flow-session.service';
import { RegistrationFlowHandler } from '../../whatsapp-flows/handlers/registration-flow.handler';
import { DepositFlowHandler } from '../../whatsapp-flows/handlers/deposit-flow.handler';
import { WalletService } from '../../wallet/wallet.service';
import { withBrand, formatNaira } from '../../whatsapp-flows/utils/brand';

@Injectable()
export class IncomingMessageHandler {
  private readonly logger = new Logger(IncomingMessageHandler.name);

  constructor(
    private readonly messageService: WhatsAppMessageService,
    private readonly prisma: PrismaService,
    private readonly aiAssistantService: AIAssistantService,
    @Optional() private readonly voiceService?: VoiceService,
    @Optional() private readonly apiService?: WhatsAppApiService,
    @Optional() private readonly flowSessionService?: FlowSessionService,
    @Optional() private readonly registrationFlowHandler?: RegistrationFlowHandler,
    @Optional() private readonly depositFlowHandler?: DepositFlowHandler,
    @Optional() private readonly walletService?: WalletService,
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

    // Handle Flow (nfm_reply) submissions
    if (
      message.type === WHATSAPP_MESSAGE_TYPES.INTERACTIVE ||
      message.type === 'interactive'
    ) {
      const interactive = (message as any).interactive;

      // Flow submission (nfm_reply)
      if (interactive?.type === 'nfm_reply' || interactive?.nfm_reply) {
        return this.handleFlowSubmission(normalizedPhone, interactive, contactName, message.id);
      }
    }

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
      } else if (replyText.includes('SELECT DATA NETWORK')) {
        // Meta allows max 3 reply buttons — show MTN/Airtel/Glo as buttons;
        // 9mobile remains typeable (body text + resolveNetworkChoice).
        const bannerUrl = this.messageService.getNetworkMediaUrl(
          'data-network-banner.png',
        );
        await this.messageService
          .sendInteractiveButtons(
            normalizedPhone,
            '🌐 *Instant Mobile Internet Data Top-Up*\n\n' +
              'Choose your network below:\n' +
              '🎁 *3% instant cashback* on every bundle\n\n' +
              "Don't see 9mobile? Reply with *9mobile*",
            [
              { id: 'MTN', title: '🟡 MTN' },
              { id: 'AIRTEL', title: '🔴 Airtel' },
              { id: 'GLO', title: '🟢 Glo' },
            ],
            undefined,
            'WAPPay Instant Banking',
            message.id,
            bannerUrl,
          )
          .catch(async () => {
            await this.messageService.sendReply(
              normalizedPhone,
              replyText,
              message.id,
            );
          });
      } else if (replyText.includes('SELECT DATA PLAN')) {
        const net = replyText.includes('Airtel')
          ? 'AIRTEL'
          : replyText.includes('Glo')
          ? 'GLO'
          : replyText.includes('9mobile')
          ? '9MOBILE'
          : 'MTN';
        const packages = DATA_PACKAGES[net] || DATA_PACKAGES.MTN;
        const logoFile =
          net === 'AIRTEL'
            ? 'data-airtel.png'
            : net === 'GLO'
            ? 'data-glo.png'
            : net === '9MOBILE'
            ? 'data-9mobile.png'
            : 'data-mtn.png';

        // Network logo banner first (lists cannot carry image headers),
        // then the interactive plan list.
        try {
          await this.messageService.sendImageMessage(
            normalizedPhone,
            this.messageService.getNetworkMediaUrl(logoFile),
            `🌐 ${net} Data Bundles — pick a plan below`,
            message.id,
          );
        } catch {
          // Image is decorative; continue to the plan list.
        }

        await this.messageService.sendInteractiveList(
          normalizedPhone,
          `Choose a ${net} data bundle below:`,
          'Select Plan',
          [
            {
              title: `${net} Data Bundles`,
              rows: packages.map((pkg) => ({
                id: pkg.plan,
                title: `${pkg.plan} (${pkg.validity})`,
                description: `₦${pkg.priceNaira.toLocaleString()} • 3% Cashback`,
              })),
            },
          ],
          '⚡ Select Data',
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
   * Handle WhatsApp Flow (nfm_reply) submissions for registration and deposit.
   */
  private async handleFlowSubmission(
    normalizedPhone: string,
    interactive: any,
    contactName: string | undefined,
    messageId: string,
  ): Promise<string> {
    const nfmReply = interactive.nfm_reply || interactive;
    const responseJson = nfmReply.response_json;

    if (!responseJson) {
      this.logger.warn(`nfm_reply missing response_json from ${maskedPhone(normalizedPhone)}`);
      const reply = withBrand('Your submission could not be processed. Please try again.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }

    let responseData: Record<string, any>;
    try {
      responseData = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson;
    } catch {
      this.logger.error(`Failed to parse nfm_reply response_json from ${maskedPhone(normalizedPhone)}`);
      const reply = withBrand('Your submission could not be processed. Please try again.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }

    const flowToken = responseData.flow_token;
    this.logger.log(
      `Flow submission from ${maskedPhone(normalizedPhone)}: token=${flowToken} keys=${Object.keys(responseData).join(',')}`,
    );

    if (!flowToken) {
      const reply = withBrand('Your session has expired. Please start again.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }

    // Try to find the session to determine flow type
    let session: any = null;
    try {
      session = await this.flowSessionService?.getSession(flowToken);
    } catch {
      // Session not found or expired — check if this is a registration completion
    }

    if (!session) {
      // Attempt to process as registration completion (session may have been completed)
      if (responseData.status === 'registered' || responseData.full_name) {
        return this.completeRegistrationFromFlow(normalizedPhone, responseData, contactName, messageId);
      }
      const reply = withBrand('Your session has expired. Please send "register" to start again.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }

    if (session.flowType === 'REGISTRATION') {
      return this.completeRegistrationFromFlow(normalizedPhone, responseData, contactName, messageId);
    }

    if (session.flowType === 'DEPOSIT') {
      return this.completeDepositFromFlow(normalizedPhone, flowToken, responseData, messageId);
    }

    const reply = withBrand('Unknown flow type. Please try again.');
    await this.messageService.sendReply(normalizedPhone, reply, messageId);
    return reply;
  }

  private async completeRegistrationFromFlow(
    normalizedPhone: string,
    responseData: Record<string, any>,
    contactName: string | undefined,
    messageId: string,
  ): Promise<string> {
    if (!this.registrationFlowHandler || !this.walletService) {
      const reply = withBrand('Registration is temporarily unavailable. Please try again later.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }

    try {
      const result = await this.registrationFlowHandler.processFlowCompletion(
        responseData.flow_token || '',
        responseData,
        normalizedPhone,
      );

      if (!result) {
        const reply = withBrand('Registration could not be completed. Please try again.');
        await this.messageService.sendReply(normalizedPhone, reply, messageId);
        return reply;
      }

      // Send wallet ready message
      const wallet = await this.walletService.getWalletByCustomerId(result.customerId);
      const balance = wallet ? wallet.balanceKobo : BigInt(0);

      const walletReadyMsg = withBrand(
        `Your WappPay wallet is ready! 🎉\n\n` +
        `Wallet Balance: ${formatNaira(balance)}\n` +
        `Wallet Type: TEST WALLET\n\n` +
        `You can now simulate deposits and explore WappPay.\n\n` +
        `What would you like to do?`,
      );

      await this.messageService.sendReply(normalizedPhone, walletReadyMsg, messageId);

      // Send interactive wallet menu
      await this.messageService
        .sendInteractiveList(
          normalizedPhone,
          'Select an option below:',
          'Choose Action',
          [
            {
              title: 'Wallet Menu',
              rows: [
                { id: 'MY_WALLET', title: 'My Wallet', description: 'View balance and wallet details' },
                { id: 'DEPOSIT_MONEY', title: 'Deposit Money', description: 'Add test funds to your wallet' },
                { id: 'TRANSACTION_HISTORY', title: 'Transaction History', description: 'View recent transactions' },
                { id: 'MAIN_MENU', title: 'Main Menu', description: 'Back to main menu' },
              ],
            },
          ],
          '💰 WappPay Wallet',
          'from WappPay',
        )
        .catch(() => {});

      return walletReadyMsg;
    } catch (err: any) {
      this.logger.error(`Registration flow completion error: ${err.message}`);
      const reply = withBrand('Registration failed. Please try again.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }
  }

  private async completeDepositFromFlow(
    normalizedPhone: string,
    flowToken: string,
    responseData: Record<string, any>,
    messageId: string,
  ): Promise<string> {
    if (!this.depositFlowHandler) {
      const reply = withBrand('Deposit is temporarily unavailable. Please try again later.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }

    try {
      const result = await this.depositFlowHandler.processFlowCompletion(
        flowToken,
        responseData,
      );

      if (!result) {
        const reply = withBrand('Deposit could not be processed. Please try again.');
        await this.messageService.sendReply(normalizedPhone, reply, messageId);
        return reply;
      }

      const amount = responseData.amount;
      const newBalance = Number(result.newBalanceKobo) / 100;

      const successMsg = withBrand(
        `Deposit Successful! 🎉\n\n` +
        `Amount: ${formatNaira(BigInt(Math.round(amount * 100)))}\n` +
        `New Balance: ${formatNaira(result.newBalanceKobo)}\n` +
        `Reference: ${result.reference}\n\n` +
        `This was a simulated test deposit.`,
      );

      await this.messageService.sendReply(normalizedPhone, successMsg, messageId);

      // Send follow-up buttons
      await this.messageService
        .sendInteractiveButtons(
          normalizedPhone,
          'What would you like to do next?',
          [
            { id: 'MY_WALLET', title: 'View Wallet' },
            { id: 'TRANSACTION_HISTORY', title: 'History' },
            { id: 'MAIN_MENU', title: 'Main Menu' },
          ],
          undefined,
          'from WappPay',
          messageId,
        )
        .catch(() => {});

      return successMsg;
    } catch (err: any) {
      this.logger.error(`Deposit flow completion error: ${err.message}`);
      const reply = withBrand('Deposit failed. Please try again.');
      await this.messageService.sendReply(normalizedPhone, reply, messageId);
      return reply;
    }
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
