import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIModule } from '../artificial-intelligence/ai.module';
import { VoiceModule } from '../voice/voice.module';
import { WhatsAppWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsAppSignatureService } from './services/whatsapp-signature.service';
import { WhatsAppApiService } from './services/whatsapp-api.service';
import { WhatsAppMessageService } from './services/whatsapp-message.service';
import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';
import { IncomingMessageHandler } from './handlers/incoming-message.handler';

/**
 * WhatsAppModule
 *
 * Encapsulates the entire WhatsApp Cloud API integration for the WAPPay platform.
 * Provides:
 *   - Webhook verification (GET /webhooks/whatsapp)
 *   - Webhook event ingestion with HMAC-SHA256 validation (POST /webhooks/whatsapp)
 *   - Outgoing message dispatch via Meta Graph API
 *   - Inbound message routing through the Groq AI Conversational Pipeline
 *   - Inbound voice note transcription via VoiceModule (Whisper Large v3)
 *   - Deduplication via the webhook_inbox Prisma model
 */
@Module({
  imports: [ConfigModule, AIModule, VoiceModule],
  controllers: [WhatsAppWebhookController],
  providers: [
    WhatsAppSignatureService,
    WhatsAppApiService,
    WhatsAppMessageService,
    WhatsAppWebhookService,
    IncomingMessageHandler,
  ],
  exports: [WhatsAppApiService, WhatsAppMessageService],
})
export class WhatsAppModule {}
