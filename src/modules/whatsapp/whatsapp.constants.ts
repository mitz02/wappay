// WhatsApp Cloud API Constants and Configurations

export const WHATSAPP_CONFIG = {
  GRAPH_API_VERSION: 'v21.0',
  DEFAULT_GRAPH_API_BASE: 'https://graph.facebook.com',
  DEFAULT_TIMEOUT_MS: 10000,
  MESSAGING_PRODUCT: 'whatsapp',
  RECIPIENT_TYPE_INDIVIDUAL: 'individual',
} as const;

export const WHATSAPP_TEST_RESPONSES = {
  INITIAL_TEST_TRIGGER: 'hello',
  INITIAL_TEST_REPLY: 'Hello! Welcome. How can I help you today?',
  UNSUPPORTED_TYPE_REPLY:
    'Currently, I can only process text messages. Please send your message as text.',
  DEFAULT_WELCOME_REPLY: 'Hello! Welcome. How can I help you today?',
} as const;

export const WHATSAPP_MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VOICE: 'voice',
  VIDEO: 'video',
  DOCUMENT: 'document',
  STICKER: 'sticker',
  LOCATION: 'location',
  CONTACTS: 'contacts',
  INTERACTIVE: 'interactive',
  BUTTON: 'button',
} as const;

export const WHATSAPP_STATUS_TYPES = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
} as const;
