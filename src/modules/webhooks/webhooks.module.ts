import { Module } from '@nestjs/common';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [MessagingModule],
  controllers: [WhatsAppWebhookController],
})
export class WebhooksModule {}
