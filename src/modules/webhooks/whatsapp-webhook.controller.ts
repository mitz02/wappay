import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from '../messaging/messaging.service';
import { ConversationRouterService } from '../messaging/conversation-router.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService,
    private readonly routerService: ConversationRouterService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Meta Webhook Verification Handshake
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const configuredToken = this.configService.get<string>('whatsapp.webhookVerifyToken');

    if (mode === 'subscribe' && token === configuredToken) {
      this.logger.log('WhatsApp webhook successfully verified with Meta');
      return challenge;
    }

    throw new ForbiddenException('Invalid Meta verification token');
  }

  /**
   * Meta Inbound Webhook Event Processing
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const rawPayload = JSON.stringify(body);

    // 1. Verify HMAC-SHA256 signature
    const isValidSignature = this.messagingService.verifyMetaSignature(
      rawPayload,
      signature,
    );

    if (!isValidSignature) {
      this.logger.warn('Received webhook with invalid HMAC signature');
      throw new ForbiddenException('Invalid signature');
    }

    // 2. Extract Message Details from standard Meta Cloud API payload
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];

      if (message && message.type === 'text') {
        const senderPhone = message.from;
        const senderName = contact?.profile?.name || 'Customer';
        const text = message.text.body;

        // Persist into transactional inbox for idempotency and auditability
        await this.prisma.webhookInbox.upsert({
          where: { eventId: message.id },
          update: {},
          create: {
            provider: 'meta',
            eventType: 'messages',
            eventId: message.id,
            payload: rawPayload,
            signature,
            status: 'RECEIVED',
          },
        });

        // Dispatch to conversational financial router
        await this.routerService.handleIncomingMessage(senderPhone, text, senderName);
      }
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp webhook event: ${err.message}`, err.stack);
    }

    // Always acknowledge Meta with 200 within 500ms
    return { status: 'EVENT_RECEIVED' };
  }
}
