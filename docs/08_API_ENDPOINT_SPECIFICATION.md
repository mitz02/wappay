# 08. API ENDPOINT SPECIFICATION & REST CONTRACTS
## WAPPay Conversational Financial Platform — Phase 1 Technical Design

---

## 1. Global API Conventions

- **Protocol:** HTTPS with TLS 1.3 only.
- **Prefix:** `/api/v1`
- **Content-Type:** `application/json`
- **Standard Response Envelope:**
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2026-11-01T18:00:00.000Z",
    "correlationId": "req_uuid_v7"
  }
}
```
- **Standard RFC 7807 Error Envelope:**
```json
{
  "success": false,
  "error": {
    "code": "FIN_001_INSUFFICIENT_FUNDS",
    "message": "Insufficient available funds to complete this transaction",
    "details": null
  },
  "metadata": {
    "timestamp": "2026-11-01T18:00:00.000Z",
    "correlationId": "req_uuid_v7"
  }
}
```

---

## 2. API Endpoint Matrix

### 2.1 Webhooks (Public Edge Endpoints)

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/webhooks/whatsapp` | Meta Verify Token | Meta Cloud API verification handshake. |
| `POST` | `/api/v1/webhooks/whatsapp` | `X-Hub-Signature-256` | Inbound WhatsApp messages, voice notes, delivery receipts. |
| `POST` | `/api/v1/webhooks/providers/:providerId` | Provider HMAC | Financial partner clearing & payout settlement webhooks. |

### 2.2 Administrator Authentication (`/api/v1/admin/auth`)

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/auth/login` | None | Email + Argon2id Password + TOTP MFA. Issues JWT pair. |
| `POST` | `/api/v1/admin/auth/refresh` | Refresh Token | Rotates expired access token. |
| `POST` | `/api/v1/admin/auth/logout` | Bearer Token | Revokes administrative session in Redis. |

### 2.3 Operations & Metrics (`/api/v1/admin/dashboard`)

| Method | Path | Auth / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/dashboard/metrics` | `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `FINANCE_ADMIN` | Authoritative metrics: active users, 24h settled volume, pending polls. |

### 2.4 Customer Management (`/api/v1/admin/customers`)

| Method | Path | Auth / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/customers` | `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `SUPPORT_ADMIN` | Search & paginate customers with masked PII. |
| `GET` | `/api/v1/admin/customers/:id` | `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `SUPPORT_ADMIN` | Customer details, KYC tier, linked virtual accounts. |
| `POST`| `/api/v1/admin/customers/:id/status`| `SUPER_ADMIN`, `OPERATIONS_ADMIN` | Suspend or restrict customer with mandatory audit reason. |

### 2.5 Transaction & Ledger Monitoring (`/api/v1/admin/transactions`)

| Method | Path | Auth / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/transactions` | `SUPER_ADMIN`, `FINANCE_ADMIN`, `AUDITOR` | Filter transactions by state, date, customer, provider ref. |
| `GET` | `/api/v1/admin/transactions/:id` | `SUPER_ADMIN`, `FINANCE_ADMIN`, `AUDITOR` | Transaction details with full event timeline & linked ledger entries. |
| `GET` | `/api/v1/admin/ledger/accounts` | `FINANCE_ADMIN`, `AUDITOR` | Chart of accounts and materialized balances. |
| `GET` | `/api/v1/admin/ledger/journals` | `FINANCE_ADMIN`, `AUDITOR` | Searchable immutable journal records. |

### 2.6 Financial Reconciliation (`/api/v1/admin/reconciliation`)

| Method | Path | Auth / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/reconciliation/runs` | `FINANCE_ADMIN`, `AUDITOR` | List past automated 3-way reconciliation audit runs. |
| `POST`| `/api/v1/admin/reconciliation/trigger`| `SUPER_ADMIN`, `FINANCE_ADMIN` | Manually initiate an on-demand reconciliation window. |

### 2.7 System Audit Logs (`/api/v1/admin/audit-logs`)

| Method | Path | Auth / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/audit-logs` | `SUPER_ADMIN`, `AUDITOR` | Searchable immutable audit trail with actor, action, diffs. |
