import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppMessageService } from '../../whatsapp/services/whatsapp-message.service';

export interface FlowMessageOptions {
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
}

/**
 * Sends WhatsApp Flows (interactive in-chat forms with TextInput, Dropdown, etc.).
 * Requires WHATSAPP_REGISTRATION_FLOW_ID / WHATSAPP_DEPOSIT_FLOW_ID after
 * uploading the Flow JSON to Meta Flows (draft or published).
 */
@Injectable()
export class FlowSenderService {
  private readonly logger = new Logger(FlowSenderService.name);

  constructor(private readonly messageService: WhatsAppMessageService) {}

  async sendFlow(options: FlowMessageOptions): Promise<boolean> {
    const {
      to,
      flowId,
      flowToken,
      cta,
      body,
      header,
      footer,
      startScreen,
      initialData,
      replyToMessageId,
    } = options;

    if (!flowId) {
      this.logger.warn(`Flow ID not configured — cannot send Flow to ${to}`);
      return false;
    }

    try {
      await this.messageService.sendInteractiveFlow({
        to,
        flowId,
        flowToken,
        cta,
        body,
        header,
        footer: footer || 'from WappPay',
        startScreen,
        initialData,
        replyToMessageId,
      });
      this.logger.log(
        `Flow form sent to ${to}: flow=${flowId} screen=${startScreen || 'default'} token=${flowToken}`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send Flow to ${to}: ${err.message}`);
      return false;
    }
  }

  async sendFlowFallback(
    to: string,
    body: string,
    ctaLabel: string,
    ctaId: string,
  ): Promise<void> {
    await this.messageService.sendInteractiveButtons(
      to,
      body,
      [{ id: ctaId, title: ctaLabel.slice(0, 20) }],
      undefined,
      'from WappPay',
    );
  }
}
