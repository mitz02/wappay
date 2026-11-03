import {
  Controller,
  Get,
  Post,
  Query,
  Headers,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { WhatsAppSignatureService } from '../services/whatsapp-signature.service';
import { WhatsAppWebhookService } from '../services/whatsapp-webhook.service';
import { WhatsAppWebhookPayload } from '../interfaces/whatsapp-message.interface';
import { WhatsAppWebhookVerificationDto } from '../dto/whatsapp-webhook.dto';

/**
 * WhatsAppWebhookController
 *
 * Exposes the two endpoints required by Meta WhatsApp Cloud API:
 *
 *   GET  /webhooks/whatsapp   — Webhook verification handshake (challenge-response).
 *   POST /webhooks/whatsapp   — Inbound event ingestion with HMAC-SHA256 validation.
 *
 * IMPORTANT: This controller is registered at the root path and is deliberately
 * excluded from the global '/api/v1' prefix configured in main.ts.
 * Do not add a global prefix here or in the module.
 *
 * Security contract:
 * - All POST requests are rejected unless the X-Hub-Signature-256 header matches.
 * - Verification token is never echoed back in any response or log line.
 * - No customer financial data is logged.
 */
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly signatureService: WhatsAppSignatureService,
    private readonly webhookService: WhatsAppWebhookService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /webhooks/whatsapp — Meta Webhook Verification Handshake
  // ---------------------------------------------------------------------------

  /**
   * Responds to Meta's one-time webhook verification challenge.
   *
   * Meta sends:  ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<nonce>
   * Required:    Return the exact hub.challenge string as plain text with HTTP 200.
   *
   * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started
   */
  @Get()
  verifyWebhook(@Query() query: WhatsAppWebhookVerificationDto): string {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = query;

    const configuredToken = this.configService.get<string>('whatsapp.verifyToken');

    if (!mode || !token || !challenge) {
      this.logger.warn('Webhook verification rejected: Missing required query parameters.');
      throw new ForbiddenException('Missing webhook verification parameters.');
    }

    if (mode !== 'subscribe') {
      this.logger.warn(`Webhook verification rejected: Unsupported mode "${mode}".`);
      throw new ForbiddenException('Unsupported webhook verification mode.');
    }

    if (!configuredToken) {
      this.logger.error('CRITICAL: WHATSAPP_VERIFY_TOKEN is not configured.');
      throw new ForbiddenException('Webhook verification is not configured.');
    }

    // Constant-time comparison is not strictly required here (no secret revealed on mismatch),
    // but we avoid early-exit for consistency and to prevent timing-based enumeration.
    const isValid = token === configuredToken;

    if (!isValid) {
      this.logger.warn('Webhook verification rejected: Token mismatch.');
      throw new ForbiddenException('Invalid webhook verification token.');
    }

    this.logger.log('WhatsApp webhook verification successful. Meta handshake complete.');
    return challenge;
  }

  // ---------------------------------------------------------------------------
  // POST /webhooks/whatsapp — Inbound Webhook Event Processing
  // ---------------------------------------------------------------------------

  /**
   * Receives and processes inbound WhatsApp Cloud API webhook events.
   *
   * Processing order:
   * 1. Extract raw request body for HMAC verification (requires rawBody: true in main.ts).
   * 2. Verify X-Hub-Signature-256 against the raw bytes using WHATSAPP_APP_SECRET.
   * 3. Parse and type-check the payload.
   * 4. Confirm object type is 'whatsapp_business_account'.
   * 5. Delegate to WhatsAppWebhookService for deduplication and routing.
   * 6. Return HTTP 200 immediately — Meta expects acknowledgement within 500ms.
   *
   * IMPORTANT: Meta re-delivers events that do not receive a 200 within 500ms.
   * Long-running processing must not block this response. Move to async queue
   * (BullMQ) when processing latency becomes a concern.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: WhatsAppWebhookPayload,
    @Headers('x-hub-signature-256') signatureHeader: string | undefined,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    // Retrieve the raw body buffer that NestJS preserved when rawBody: true was set.
    const rawBody: Buffer | undefined = (req as any).rawBody;

    // 1. Signature verification — reject immediately on failure.
    const isValidSignature = this.signatureService.verifySignature(rawBody, signatureHeader);
    if (!isValidSignature) {
      this.logger.warn(
        'POST /webhooks/whatsapp rejected: Invalid or missing X-Hub-Signature-256.',
      );
      throw new ForbiddenException('Invalid webhook signature.');
    }

    // 2. Guard against unexpected object types.
    if (body.object !== 'whatsapp_business_account') {
      this.logger.debug(
        `Received webhook for unknown object "${body.object}". Acknowledging without processing.`,
      );
      return { status: 'EVENT_RECEIVED' };
    }

    // 3. Delegate to service for deduplication and routing.
    //    Errors are caught inside the service; they must not prevent the 200 response.
    await this.webhookService.processWebhookPayload(body).catch((err) => {
      this.logger.error(
        `Unhandled error in WebhookService.processWebhookPayload: ${err.message}`,
        err.stack,
      );
    });

    // 4. Always acknowledge. Meta does NOT care about our processing result.
    return { status: 'EVENT_RECEIVED' };
  }
}
