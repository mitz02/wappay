import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IncomingMessageHandler } from '../handlers/incoming-message.handler';
import {
  WhatsAppWebhookPayload,
  WhatsAppValue,
  WhatsAppMessage,
  WhatsAppContact,
} from '../interfaces/whatsapp-message.interface';

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incomingMessageHandler: IncomingMessageHandler,
  ) {}

  /**
   * Processes an authenticated, validated WhatsApp Business webhook payload.
   *
   * Responsibilities:
   * - Iterate over all entries and changes in the Meta batch payload.
   * - Deduplicate incoming messages using the webhook_inbox table (idempotent upsert).
   * - Dispatch unique text messages to IncomingMessageHandler.
   * - Acknowledge delivery-status notifications without processing.
   * - Never block Meta's 500 ms acknowledgement window — all heavy logic stays here.
   *
   * @param payload - Fully typed Meta webhook payload.
   */
  async processWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      this.logger.warn(
        `Received unexpected webhook object type: "${payload.object}". Ignoring.`,
      );
      return;
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') {
          this.logger.debug(
            `Skipping non-message change field: "${change.field}"`,
          );
          continue;
        }

        await this.processChangeValue(change.value);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Processes a single change value object from a webhook batch.
   * Handles both inbound messages and delivery-status notifications.
   */
  private async processChangeValue(value: WhatsAppValue): Promise<void> {
    // Handle delivery-status notifications (sent, delivered, read, failed)
    if (value.statuses && value.statuses.length > 0) {
      for (const status of value.statuses) {
        this.logger.log(
          `Delivery status update: messageId=${status.id} status=${status.status} recipient=${this.maskPhone(status.recipient_id)}`,
        );
      }
    }

    // Handle inbound messages
    if (!value.messages || value.messages.length === 0) {
      return;
    }

    const contacts = value.contacts ?? [];

    for (const message of value.messages) {
      await this.processIncomingMessage(message, contacts);
    }
  }

  /**
   * Processes a single inbound WhatsApp message with strict deduplication.
   * Uses an atomic upsert so repeated deliveries of the same message ID
   * are detected and discarded before any business logic runs.
   */
  private async processIncomingMessage(
    message: WhatsAppMessage,
    contacts: WhatsAppContact[],
  ): Promise<void> {
    const messageId = message.id;

    try {
      // Deduplication gate: check if we've already seen this event.
      const existing = await this.prisma.webhookInbox.findUnique({
        where: { eventId: messageId },
      });

      if (existing) {
        this.logger.warn(
          `Duplicate WhatsApp webhook event detected and discarded. messageId=${messageId} previousStatus=${existing.status}`,
        );
        return;
      }

      // Claim the event atomically before running any business logic.
      await this.prisma.webhookInbox.create({
        data: {
          provider: 'meta',
          eventType: 'messages',
          eventId: messageId,
          payload: JSON.stringify(message),
          status: 'RECEIVED',
        },
      });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      // Unique-constraint violation means a concurrent request already claimed this event.
      if (error.code === 'P2002') {
        this.logger.warn(
          `Race-condition deduplication: event ${messageId} was claimed by a concurrent request. Skipping.`,
        );
        return;
      }
      this.logger.error(
        `Failed to record webhook_inbox entry for messageId=${messageId}: ${error.message}`,
      );
    }

    // Look up optional contact display name for identity tracking.
    const contactName = contacts.find((c) => c.wa_id === message.from)?.profile?.name;

    try {
      await this.incomingMessageHandler.handleMessage(message, contactName);

      // Mark event as successfully processed.
      await this.prisma.webhookInbox.update({
        where: { eventId: messageId },
        data: { status: 'PROCESSED' },
      });

      this.logger.log(`Successfully processed WhatsApp message ${messageId}`);
    } catch (err: unknown) {
      const error = err as { message?: string; stack?: string };
      this.logger.error(
        `Error processing WhatsApp message ${messageId}: ${error.message}`,
        error.stack,
      );

      // Record failure for operational visibility and replay capability.
      await this.prisma.webhookInbox.update({
        where: { eventId: messageId },
        data: {
          status: 'FAILED',
          error: error.message,
        },
      }).catch((updateErr: unknown) => {
        const ue = updateErr as { message?: string };
        this.logger.error(
          `Failed to update webhook_inbox error status for ${messageId}: ${ue.message}`,
        );
      });
    }
  }

  /** Masks a phone number for safe diagnostic logging. */
  private maskPhone(phone: string): string {
    if (!phone || phone.length <= 6) return '***';
    return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
  }
}
