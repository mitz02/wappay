# SECURITY ARCHITECTURE SPECIFICATION
## WAPPay Banking Platform

---

### 1. Customer Security (WhatsApp Channel)
- **Credential Storage:** PINs are stored as one-way memory-hard hashes using **Argon2id** (`m=65536, t=3, p=4`). Plaintext PINs are never persisted in the database or written to logs.
- **Single-Use Challenge Tokens:** Financial previews emit a cryptographically random token (`crypto.randomBytes(16)`) expiring in 5 minutes.
- **Brute-Force Rate Limiting:** 3 failed PIN attempts trigger an automatic 30-minute lockout.

### 2. Administrative Security (Web Dashboard)
- **Zero Customer Surface:** The web application provides zero routes for customer registration or wallet access.
- **Role-Based Access Control (RBAC):** Guarded routes enforcing granular roles:
  - `SUPER_ADMIN`
  - `OPERATIONS_ADMIN`
  - `FINANCE_ADMIN`
  - `SUPPORT_ADMIN`
  - `AUDITOR`
- **MFA Enforcement:** Mandatory TOTP (RFC 6238) for administrative sessions.

### 3. API & Webhook Hardening
- **HMAC Signature Verification:** Inbound Meta WhatsApp webhooks require valid `X-Hub-Signature-256` computed with the shared app secret.
- **Sanitized Errors:** Internal database stack traces and credentials are intercepted by `GlobalExceptionFilter` and redacted from public responses.
- **IS_SIMULATED Safety Gate:** Hard gate preventing accidental live execution until verified.
