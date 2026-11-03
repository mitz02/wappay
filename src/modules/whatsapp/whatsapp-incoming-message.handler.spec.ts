import { IncomingMessageHandler } from './handlers/incoming-message.handler';
import { WhatsAppMessageService } from './services/whatsapp-message.service';
import { WhatsAppMessage } from './interfaces/whatsapp-message.interface';
import { WHATSAPP_TEST_RESPONSES } from './whatsapp.constants';
import { AIAssistantService } from '../artificial-intelligence/services/ai-assistant.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTextMessage(text: string, id = 'wamid.TEST_001'): WhatsAppMessage {
  return {
    from: '2348012345678',
    id,
    timestamp: '1700000000',
    type: 'text',
    text: { body: text },
  };
}

function buildImageMessage(): WhatsAppMessage {
  return {
    from: '2348012345678',
    id: 'wamid.TEST_IMG',
    timestamp: '1700000001',
    type: 'image',
    image: { id: 'media_abc', mime_type: 'image/jpeg', sha256: 'def456' },
  };
}

function buildAudioMessage(mediaId = 'audio_123'): WhatsAppMessage {
  return {
    from: '2348012345678',
    id: 'wamid.TEST_AUDIO',
    timestamp: '1700000002',
    type: 'audio',
    audio: { id: mediaId, mime_type: 'audio/ogg; codecs=opus', voice: true },
  };
}

function makeHandler(
  prismaOverrides: Record<string, unknown> = {},
  aiOverrides: Partial<AIAssistantService> = {},
  voiceOverrides: Record<string, unknown> = {},
) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1', customerProfile: {} }),
    },
    $transaction: jest.fn().mockResolvedValue(undefined),
    ...prismaOverrides,
  };

  const messageService = {
    normalizePhoneNumber: jest.fn((p: string) => p),
    sendReply: jest.fn().mockResolvedValue({
      messaging_product: 'whatsapp',
      contacts: [],
      messages: [{ id: 'wamid.OUT_001' }],
    }),
  } as unknown as WhatsAppMessageService;

  const aiAssistantService = {
    processCustomerMessage: jest.fn().mockImplementation((_phone: string, text: string) => {
      const lower = text.trim().toLowerCase();
      if (lower === 'hello') return Promise.resolve(WHATSAPP_TEST_RESPONSES.INITIAL_TEST_REPLY);
      if (lower === '') return Promise.resolve(WHATSAPP_TEST_RESPONSES.DEFAULT_WELCOME_REPLY);
      return Promise.resolve(WHATSAPP_TEST_RESPONSES.DEFAULT_WELCOME_REPLY);
    }),
    ...aiOverrides,
  } as unknown as AIAssistantService;

  const voiceService = {
    processVoiceNote: jest.fn().mockResolvedValue(
      '🎙️ *Voice Note:* _"Send 5000 naira to Mum"_\n\n📋 *Transfer Confirmation*',
    ),
    ...voiceOverrides,
  };

  const apiService = {
    downloadMedia: jest.fn().mockResolvedValue({
      buffer: Buffer.from('simulated_audio'),
      mimeType: 'audio/ogg',
      fileSizeBytes: 100,
    }),
  };

  const handler = new IncomingMessageHandler(
    messageService,
    prisma as any,
    aiAssistantService,
    voiceService as any,
    apiService as any,
  );
  return { handler, messageService, prisma, aiAssistantService, voiceService, apiService };
}

// ---------------------------------------------------------------------------
// IncomingMessageHandler
// ---------------------------------------------------------------------------

describe('IncomingMessageHandler', () => {
  // -------------------------------------------------------------------------
  // Conversational AI routing
  // -------------------------------------------------------------------------

  it('routes incoming text to AIAssistantService and replies via WhatsApp', async () => {
    const { handler, messageService, aiAssistantService } = makeHandler();
    const reply = await handler.handleMessage(buildTextMessage('Hello'), 'Test User');

    expect(aiAssistantService.processCustomerMessage).toHaveBeenCalledWith(
      '2348012345678',
      'Hello',
      'Test User',
    );
    expect(messageService.sendReply).toHaveBeenCalledWith(
      '2348012345678',
      WHATSAPP_TEST_RESPONSES.INITIAL_TEST_REPLY,
      'wamid.TEST_001',
    );
    expect(reply).toBe(WHATSAPP_TEST_RESPONSES.INITIAL_TEST_REPLY);
  });

  it('delivers AI response for general queries', async () => {
    const { handler, messageService, aiAssistantService } = makeHandler();
    (aiAssistantService.processCustomerMessage as jest.Mock).mockResolvedValue(
      'WAPPay is an AI financial platform.',
    );

    const reply = await handler.handleMessage(buildTextMessage('What does WAPPay do?'));
    expect(reply).toBe('WAPPay is an AI financial platform.');
    expect(messageService.sendReply).toHaveBeenCalledWith(
      '2348012345678',
      'WAPPay is an AI financial platform.',
      'wamid.TEST_001',
    );
  });

  it('gracefully handles AI Assistant processing errors without crashing', async () => {
    const { handler, messageService, aiAssistantService } = makeHandler();
    (aiAssistantService.processCustomerMessage as jest.Mock).mockRejectedValue(
      new Error('Groq unavailable'),
    );

    const reply = await handler.handleMessage(buildTextMessage('Hello'));
    expect(reply).toBe(WHATSAPP_TEST_RESPONSES.DEFAULT_WELCOME_REPLY);
    expect(messageService.sendReply).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Unsupported message types
  // -------------------------------------------------------------------------

  it('replies with the unsupported-type notice for image messages without calling AI', async () => {
    const { handler, messageService, aiAssistantService } = makeHandler();
    const reply = await handler.handleMessage(buildImageMessage());

    expect(reply).toBe(WHATSAPP_TEST_RESPONSES.UNSUPPORTED_TYPE_REPLY);
    expect(aiAssistantService.processCustomerMessage).not.toHaveBeenCalled();
    expect(messageService.sendReply).toHaveBeenCalledWith(
      '2348012345678',
      WHATSAPP_TEST_RESPONSES.UNSUPPORTED_TYPE_REPLY,
      'wamid.TEST_IMG',
    );
  });

  it('replies with the unsupported-type notice for document messages without calling AI', async () => {
    const { handler, aiAssistantService } = makeHandler();
    const docMsg: WhatsAppMessage = {
      from: '2348012345678',
      id: 'wamid.DOC_001',
      timestamp: '1700000002',
      type: 'document',
    };
    const reply = await handler.handleMessage(docMsg);
    expect(reply).toBe(WHATSAPP_TEST_RESPONSES.UNSUPPORTED_TYPE_REPLY);
    expect(aiAssistantService.processCustomerMessage).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Phone normalization
  // -------------------------------------------------------------------------

  it('normalizes the sender phone number before routing to AI and sending reply', async () => {
    const { handler, messageService, aiAssistantService } = makeHandler();
    (messageService.normalizePhoneNumber as jest.Mock).mockReturnValue('2348012345678');

    const msg = buildTextMessage('Hello');
    (msg as any).from = '+234 801-234-5678';

    await handler.handleMessage(msg);

    expect(messageService.normalizePhoneNumber).toHaveBeenCalledWith('+234 801-234-5678');
    expect(aiAssistantService.processCustomerMessage).toHaveBeenCalledWith(
      '2348012345678',
      'Hello',
      undefined,
    );
    expect(messageService.sendReply).toHaveBeenCalledWith(
      '2348012345678',
      expect.any(String),
      expect.any(String),
    );
  });

  // -------------------------------------------------------------------------
  // Identity tracking — non-blocking failure
  // -------------------------------------------------------------------------

  it('still sends a reply when DB identity tracking throws', async () => {
    const { handler, messageService } = makeHandler({
      user: {
        findUnique: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      },
    });

    const reply = await handler.handleMessage(buildTextMessage('Hello'));
    expect(reply).toBe(WHATSAPP_TEST_RESPONSES.INITIAL_TEST_REPLY);
    expect(messageService.sendReply).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Duplicate prevention — does not create duplicate customer records
  // -------------------------------------------------------------------------

  it('does not call $transaction when the user already exists', async () => {
    const { handler, prisma } = makeHandler({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'existing-user',
          customerProfile: { status: 'PENDING_VERIFICATION' },
        }),
      },
    });

    await handler.handleMessage(buildTextMessage('Hello'));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('calls $transaction exactly once for a brand-new phone number', async () => {
    const { handler, prisma } = makeHandler({
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await handler.handleMessage(buildTextMessage('Hello'));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Voice note processing
  // -------------------------------------------------------------------------

  it('routes incoming audio voice note to VoiceService and sends reply', async () => {
    const { handler, messageService, voiceService } = makeHandler();
    const reply = await handler.handleMessage(buildAudioMessage('audio_abc'), 'Test User');

    expect(voiceService.processVoiceNote).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'audio_abc',
        senderPhone: '2348012345678',
        senderName: 'Test User',
      }),
    );
    expect(reply).toContain('🎙️ *Voice Note:*');
    expect(messageService.sendReply).toHaveBeenCalledWith(
      '2348012345678',
      expect.stringContaining('🎙️ *Voice Note:*'),
      'wamid.TEST_AUDIO',
    );
  });

  it('handles missing audio media ID gracefully', async () => {
    const { handler, messageService } = makeHandler();
    const audioMsg: WhatsAppMessage = {
      from: '2348012345678',
      id: 'wamid.TEST_AUDIO_NO_ID',
      timestamp: '1700000003',
      type: 'audio',
      audio: { id: '', mime_type: 'audio/ogg' },
    };

    const reply = await handler.handleMessage(audioMsg);
    expect(reply).toContain('missing media ID');
    expect(messageService.sendReply).toHaveBeenCalled();
  });
});
