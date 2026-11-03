// Meta WhatsApp Cloud API Typings and Contracts

export interface WhatsAppTextMessage {
  body: string;
}

export interface WhatsAppMessage {
  from: string; // Sender WhatsApp ID / Phone number (e.g. "2348012345678")
  id: string;   // Unique Meta WhatsApp message ID (e.g. "wamid.HBgL...")
  timestamp: string;
  type: string;
  text?: WhatsAppTextMessage;
  image?: { id: string; mime_type: string; sha256: string };
  audio?: { id: string; mime_type: string; voice?: boolean };
  voice?: { id: string; mime_type: string };
  interactive?: any;
  context?: {
    from: string;
    id: string; // Replying to message ID
  };
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details: string };
  }>;
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppValue {
  messaging_product: string;
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
  }>;
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string; // e.g. "messages"
}

export interface WhatsAppEntry {
  id: string; // WABA ID
  changes: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object: string; // "whatsapp_business_account"
  entry: WhatsAppEntry[];
}

export interface WhatsAppOutgoingMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url?: boolean;
    body: string;
  };
  context?: {
    message_id: string;
  };
}

export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string; // e.g. "wamid.HBgL..."
  }>;
}
