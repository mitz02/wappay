import { WhatsAppWebhookService } from './services/whatsapp-webhook.service';
import { IncomingMessageHandler } from './handlers/incoming-message.handler';
import { WhatsAppWebhookPayload } from './interfaces/whatsapp-message.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTextMessagePayload(messageId: string, text = 'Hello'): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_123',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001234', phone_number_id: 'PNI_123' },
              contacts: [{ profile: { name: 'Test User' }, wa_id: '2348012345678' }],
              messages: [
                {
                  from: '2348012345678',
                  id: messageId,
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buildStatusPayload(): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_123',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001234', phone_number_id: 'PNI_123' },
              statuses: [
                {
                  id: 'wamid.OUTMSG_001',
                  status: 'delivered',
                  timestamp: '1700000001',
                  recipient_id: '2348012345678',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function makeService() {
  const prisma = {
    webhookInbox: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1, eventId: 'wamid.MSG_001', status: 'RECEIVED' }),
      update: jest.fn().mockResolvedValue({ id: 1, status: 'PROCESSED' }),
    },
  };

  const handler = {
    handleMessage: jest.fn().mockResolvedValue(
      'Hello! Welcome. How can I help you today?',
    ),
  } as unknown as IncomingMessageHandler;

  const service = new WhatsAppWebhookService(prisma as any, handler);
  return { service, prisma, handler };
}

// ---------------------------------------------------------------------------
// WhatsAppWebhookService
// ---------------------------------------------------------------------------

describe('WhatsAppWebhookService', () => {
  // -------------------------------------------------------------------------
  // Object type guard
  // -------------------------------------------------------------------------

  it('silently ignores payloads with the wrong object type', async () => {
    const { service, handler } = makeService();
    const badPayload = { object: 'page', entry: [] } as any;

    await expect(service.processWebhookPayload(badPayload)).resolves.not.toThrow();
    expect(handler.handleMessage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Happy path — inbound message
  // -------------------------------------------------------------------------

  it('processes a valid inbound text message end-to-end', async () => {
    const { service, prisma, handler } = makeService();
    await service.processWebhookPayload(buildTextMessagePayload('wamid.MSG_001'));

    expect(prisma.webhookInbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: 'wamid.MSG_001', status: 'RECEIVED' }),
      }),
    );
    expect(handler.handleMessage).toHaveBeenCalledTimes(1);
    expect(prisma.webhookInbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PROCESSED' } }),
    );
  });

  // -------------------------------------------------------------------------
  // Deduplication
  // -------------------------------------------------------------------------

  it('skips a message that has already been recorded (deduplication)', async () => {
    const { service, prisma, handler } = makeService();
    prisma.webhookInbox.findUnique.mockResolvedValue({ id: 1, eventId: 'wamid.DUP', status: 'PROCESSED' });

    await service.processWebhookPayload(buildTextMessagePayload('wamid.DUP'));

    expect(handler.handleMessage).not.toHaveBeenCalled();
    expect(prisma.webhookInbox.create).not.toHaveBeenCalled();
  });

  it('handles a Prisma P2002 race-condition duplicate gracefully', async () => {
    const { service, prisma, handler } = makeService();
    prisma.webhookInbox.findUnique.mockResolvedValue(null);
    const p2002: any = new Error('Unique constraint violation');
    p2002.code = 'P2002';
    prisma.webhookInbox.create.mockRejectedValue(p2002);

    await expect(service.processWebhookPayload(buildTextMessagePayload('wamid.RACE'))).resolves.not.toThrow();
    expect(handler.handleMessage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Delivery status notifications
  // -------------------------------------------------------------------------

  it('does not call handleMessage for delivery status notifications', async () => {
    const { service, handler } = makeService();
    await service.processWebhookPayload(buildStatusPayload());
    expect(handler.handleMessage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Non-message change fields
  // -------------------------------------------------------------------------

  it('skips changes with field !== "messages"', async () => {
    const { service, handler } = makeService();
    const payload: WhatsAppWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_123',
          changes: [{ field: 'account_alerts' as any, value: {} as any }],
        },
      ],
    };
    await service.processWebhookPayload(payload);
    expect(handler.handleMessage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Handler failure — marks inbox FAILED and does not re-throw
  // -------------------------------------------------------------------------

  it('marks the inbox entry as FAILED when handleMessage throws, without propagating', async () => {
    const { service, prisma, handler } = makeService();
    (handler.handleMessage as jest.Mock).mockRejectedValue(new Error('API down'));

    await expect(service.processWebhookPayload(buildTextMessagePayload('wamid.FAIL'))).resolves.not.toThrow();

    expect(prisma.webhookInbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Empty entry array
  // -------------------------------------------------------------------------

  it('handles an empty entry array without throwing', async () => {
    const { service, handler } = makeService();
    const emptyPayload: WhatsAppWebhookPayload = { object: 'whatsapp_business_account', entry: [] };
    await expect(service.processWebhookPayload(emptyPayload)).resolves.not.toThrow();
    expect(handler.handleMessage).not.toHaveBeenCalled();
  });
});
