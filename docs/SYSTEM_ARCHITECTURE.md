# SYSTEM ARCHITECTURE SPECIFICATION
## WAPPay Conversational Banking Platform

---

### 1. Architectural Style
WAPPay is implemented as a high-integrity, domain-driven **Modular Monolith** using NestJS, PostgreSQL 16 (ACID), Redis 7, and BullMQ.
It encapsulates domain modules behind strict internal service boundaries to enable future service extraction without rewriting core financial logic.

### 2. Trust Boundaries & Channel Isolation
- **Customer Boundary (WhatsApp):** Inbound WhatsApp messages are untrusted. Text/voice messages are received via Meta Cloud API webhooks with HMAC-SHA256 signature verification.
- **AI Processing Boundary:** Natural language processing is sandboxed. The AI produces structured proposals (`ParsedIntentProposal`) but has zero database execution or balance modification privileges.
- **Authorization Boundary:** A WhatsApp identity alone cannot execute transactions. A time-limited (5-minute) single-use authorization challenge requires the customer's transaction PIN verified with Argon2id.
- **Ledger Boundary:** Customer balances are not stored as mutable numbers. All financial mutations must pass through balanced double-entry journal entries ($\sum \text{Debits} = \sum \text{Credits}$).
- **Administrative Web Boundary:** Exclusively for platform administrators. Contains zero customer registration, login, or wallet interfaces.
