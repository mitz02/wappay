# 17. WhatsApp Cloud API Integration Guide

This guide describes how to configure, run, and test the Meta WhatsApp Business Cloud API integration in the WAPPay financial platform.

---

## 1. Architecture Overview

The WhatsApp integration provides:
- **Webhook Verification (`GET /webhooks/whatsapp`)**: Validates the Meta challenge-response handshake without exposing secret tokens.
- **Inbound Event Processing (`POST /webhooks/whatsapp`)**: Ingests incoming events, validates Meta's `X-Hub-Signature-256` HMAC header against raw request bytes, deduplicates incoming message IDs using the transactional `webhook_inbox` table, and dispatches to handler logic.
- **Outgoing API Service (`WhatsAppApiService`)**: Sends individual text messages and replies through Meta Graph API with timeout control, non-retriable failure handling, and simulated sandbox support.
- **Identity Isolation**: Records sender phone numbers in `CustomerProfile` in `PENDING_VERIFICATION` status without automatically authorizing financial operations.

```
       Meta Cloud API
             │
             │ HTTPS POST /webhooks/whatsapp
             ▼
  ┌────────────────────────────────────────────────────────┐
  │ WhatsAppWebhookController                              │
  │  - Raw body HMAC SHA-256 check (WhatsAppSignatureService)
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ WhatsAppWebhookService                                 │
  │  - Deduplication via webhook_inbox (atomic claim)      │
  │  - Discard delivery receipts (sent, read, delivered)   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ IncomingMessageHandler                                 │
  │  - Non-text types → Unsupported type warning reply     │
  │  - "Hello" → Milestone connectivity test reply         │
  │  - Track user identity (PENDING_VERIFICATION)          │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ WhatsAppApiService                                     │
  │  - Outgoing HTTPS POST to Meta Graph API v21.0         │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Required Environment Variables

Add the following variables to your `.env` file (or provide via container environment):

| Variable | Description | Example / Default |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System User Permanent Token or Temporary Developer Token | `EAAG...` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Phone Number ID (Sender ID) | `102938475601928` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID (WABA) | `109283746501928` |
| `WHATSAPP_VERIFY_TOKEN` | Secret string chosen by you for the Meta webhook handshake | `wappay_meta_verify_secret_2026` |
| `WHATSAPP_APP_SECRET` | Meta App Secret from App Settings &gt; Basic | `3a9f0b1c2d3e4f5a...` |
| `WHATSAPP_API_URL` | Graph API base URL | `https://graph.facebook.com/v21.0` |
| `WHATSAPP_API_TIMEOUT_MS` | HTTP timeout in milliseconds for outgoing calls | `10000` |
| `IS_SIMULATED` | When `true` and token starts with `mock_`, API calls are simulated | `false` |

---

## 3. Obtaining Meta Credentials

### Step 1: Meta Developer Account & App Setup
1. Log in to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** &gt; **Create App**.
3. Select **Other** as the use case, then choose **Business** as the app type.
4. Provide an App Name (e.g., `WAPPay Engine`) and associate your Business Account.

### Step 2: Add WhatsApp Product
1. On the App Dashboard, find **WhatsApp** and click **Set up**.
2. Navigate to **WhatsApp** &gt; **API Setup** in the left sidebar.
3. You will see:
   - **Temporary Access Token**: Valid for 24 hours (for initial testing).
   - **Phone Number ID**: Copy to `WHATSAPP_PHONE_NUMBER_ID`.
   - **WhatsApp Business Account ID**: Copy to `WHATSAPP_BUSINESS_ACCOUNT_ID`.

### Step 3: Permanent System User Token (for Staging / Production)
1. Go to [Meta Business Settings](https://business.facebook.com/settings/).
2. Under **Users** &gt; **System Users**, create a System User with role `Admin`.
3. Under **Assets**, assign your WhatsApp Business Account with `Full Control`.
4. Click **Generate New Token**, select the App, and check permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copy the generated token to `WHATSAPP_ACCESS_TOKEN`.

### Step 4: App Secret
1. In Meta Developer Dashboard, navigate to **App Settings** &gt; **Basic**.
2. Click **Show** next to **App Secret**.
3. Copy to `WHATSAPP_APP_SECRET`.

---

## 4. Local Development Tunnel (HTTPS)

Meta requires an accessible HTTPS URL with a valid certificate for webhook delivery.

### Option A: Using ngrok
```bash
# Run local backend
npm run start:dev

# In a separate terminal, expose port 3000
ngrok http 3000
```
Copy the forwarding URL (e.g., `https://abc-123.ngrok-free.app`).

### Option B: Using localtunnel
```bash
npx localtunnel --port 3000
```

---

## 5. Webhook Configuration in Meta Dashboard

1. Navigate to **WhatsApp** &gt; **Configuration** in the Meta Developer Dashboard.
2. In the **Webhook** section, click **Edit**:
   - **Callback URL**: `https://<your-tunnel-domain>/webhooks/whatsapp`
     *(Note: `/webhooks/whatsapp` is deliberately excluded from the `/api/v1` prefix).*
   - **Verify Token**: Paste the exact value configured in `WHATSAPP_VERIFY_TOKEN`.
3. Click **Verify and Save**. Meta will send a `GET` request:
   ```
   GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<nonce>
   ```
   The backend verifies the token and replies with `hub.challenge`.
4. In **Webhook Fields**, click **Manage** and subscribe to:
   - `messages` (Inbound messages and delivery status updates)

---

## 6. Testing

### Test 1: Connectivity Test via Real WhatsApp Device
1. Add your recipient phone number to the **To** list in Meta Developer Dashboard (API Setup &gt; Step 1: Manage phone number list).
2. From that recipient's phone, send:
   ```text
   Hello
   ```
3. The backend responds automatically:
   ```text
   Hello! Welcome. How can I help you today?
   ```

### Test 2: Sending a Local Simulated Webhook (cURL)
To test signature validation locally:

```bash
# Generate HMAC signature
SECRET="your_app_secret"
PAYLOAD='{"object":"whatsapp_business_account","entry":[{"id":"1","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"1555","phone_number_id":"123"},"contacts":[{"profile":{"name":"Tester"},"wa_id":"2348012345678"}],"messages":[{"from":"2348012345678","id":"wamid.TEST_001","timestamp":"1700000000","type":"text","text":{"body":"Hello"}}]}}]}]}'
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"

curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: $SIGNATURE" \
  -d "$PAYLOAD"
```
Expected response:
```json
{"status":"EVENT_RECEIVED"}
```

---

## 7. Example Webhook Payloads

### Inbound Text Message Event
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "109283746501928",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+15550001234",
              "phone_number_id": "102938475601928"
            },
            "contacts": [
              {
                "profile": { "name": "Jane Doe" },
                "wa_id": "2348012345678"
              }
            ],
            "messages": [
              {
                "from": "2348012345678",
                "id": "wamid.HBgLMTIzNDU2Nzg5MDFGAhIA",
                "timestamp": "1730487000",
                "type": "text",
                "text": {
                  "body": "Hello"
                }
              }
            ]
          }
        }
      }
    }
  ]
}
```

### Delivery Status Update Event (Handled / Ignored)
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "109283746501928",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "+15550001234",
              "phone_number_id": "102938475601928"
            },
            "statuses": [
              {
                "id": "wamid.HBgLMTIzNDU2Nzg5MDFGAhIA",
                "status": "delivered",
                "timestamp": "1730487005",
                "recipient_id": "2348012345678"
              }
            ]
          }
        }
      }
    }
  ]
}
```

---

## 8. Common Troubleshooting & Error Handling

| Symptom / Error | Root Cause | Solution |
|---|---|---|
| `ForbiddenException: Invalid webhook verification token` | Meta verify token doesn't match `WHATSAPP_VERIFY_TOKEN` | Confirm exact string in Meta dashboard matches `.env`. |
| `ForbiddenException: Invalid webhook signature` | App Secret mismatch or rawBody altered | Ensure `WHATSAPP_APP_SECRET` is correct; verify `rawBody: true` is configured in `NestFactory.create()`. |
| HTTP 401 on outgoing messages | Access token expired or invalid | Generate a permanent System User Token in Business Manager. |
| Message not received on phone | Recipient not on test list (in Development mode) | Add number to allowed recipient list in Meta Developer Portal API Setup. |
| Duplicate replies to same message | Meta retry on slow acknowledgement | The backend acknowledges with HTTP 200 within 500ms and uses `webhook_inbox` deduplication. |
| Inbound messages not triggering endpoint | Webhook field `messages` not subscribed | In Meta Dashboard &gt; Webhooks, ensure `messages` is checked. |
