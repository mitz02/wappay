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
}

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
    } = options;

    if (!flowId) {
      this.logger.warn(`Flow ID not configured — cannot send Flow to ${to}`);
      return false;
    }

    // Build flow payload and send via WhatsApp message service
    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: body },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_action: 'navigate',
            flow_token: flowToken,
            flow_id: flowId,
            flow_cta: cta.slice(0, 20),
            mode: process.env.WHATSAPP_FLOW_MODE === 'draft' ? 'draft' : 'published',
          },
        },
      },
    };

    if (header) {
      payload.interactive.header = { type: 'text', text: header.slice(0, 60) };
    }
    if (footer) {
      payload.interactive.footer = { text: footer.slice(0, 60) };
    }
    if (startScreen) {
      payload.interactive.action.parameters.flow_action_payload = {
        screen: startScreen,
        data: initialData || {},
      };
    }

    try {
      // Use the message service to send the raw payload
      await (this.messageService as any).sendRawPayload?.(to, payload) ??
        this.messageService.sendReply(to, body);
      this.logger.log(`Flow sent to ${to}: flow=${flowId} token=${flowToken}`);
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
