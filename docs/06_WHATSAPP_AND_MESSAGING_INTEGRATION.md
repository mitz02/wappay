# 06. WHATSAPP CLOUD API INTEGRATION ARCHITECTURE
## WAPPay Conversational Financial Platform — Phase 1 Technical Design

---

## 1. Meta WhatsApp Cloud API Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer (WhatsApp)
    participant Meta as Meta Cloud Infrastructure
    participant Edge as Edge Reverse Proxy / WAF
    participant Webhook as Webhook Controller
    participant Inbox as Transactional Webhook Inbox
    participant Worker as BullMQ Queue Worker
    participant Router as Conversation Router

    User->>Meta: "Send ₦5,000 to Mum"
    Meta->>Edge: HTTPS POST /api/v1/webhooks/whatsapp (Signed with X-Hub-Signature-256)
    Edge->>Webhook: Route request
    Webhook->>Webhook: Verify HMAC-SHA256 signature using App Secret
    alt Signature Invalid
        Webhook-->>Edge: HTTP 403 Forbidden (Immediate drop)
    else Signature Valid
        Webhook->>Inbox: Upsert message ID into webhook_inbox (Deduplication)
        Webhook-->>Meta: HTTP 200 { status: "EVENT_RECEIVED" } (Within 500ms)
        Note over Webhook,Meta: Meta will NOT retry when 200 is acknowledged fast
        Inbox->>Worker: Enqueue background processing job
        Worker->>Router: Dispatch message payload to Conversation Router
        Router-->>User: Reply via WhatsApp Graph API
    end
```

---

## 2. Inbound Webhook Verification Handshake
Meta requires a one-time verification handshake when registering webhook URLs in the Meta Developer Portal:

- **Endpoint:** `GET /api/v1/webhooks/whatsapp`
- **Query Parameters:**
  - `hub.mode`: Must equal `'subscribe'`.
  - `hub.verify_token`: Must match configured `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
  - `hub.challenge`: Random challenge integer sent by Meta.
- **Response:** The server returns `hub.challenge` as plain text with HTTP 200.

---

## 3. Cryptographic Signature Verification
Meta calculates an HMAC-SHA256 hash across the raw request body using the Meta App Secret. Every incoming POST request includes:
`X-Hub-Signature-256: sha256=<hex_digest>`

### Verification Implementation:
1. Capture raw, unparsed request buffer before body-parser serialization.
2. Compute `crypto.createHmac('sha256', appSecret).update(rawBuffer).digest('hex')`.
3. Use `crypto.timingSafeEqual` to prevent timing-attack side-channel vulnerabilities.

---

## 4. Transactional Inbox & Deduplication
WhatsApp / Meta webhooks follow **at-least-once delivery semantics**. If an acknowledgement takes longer than 20 seconds, Meta automatically retries sending the same message.

To prevent duplicate transfers:
1. Every message includes a unique Meta message ID (`wamid.HBg...`).
2. The `webhook_inbox` table enforces `UNIQUE(eventId)`.
3. If an incoming message ID already exists:
   - It is acknowledged immediately with HTTP 200.
   - Processing is skipped, preventing duplicate processing by the conversational engine.
