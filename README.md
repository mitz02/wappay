# WAPPay: AI-Powered Conversational Financial Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%2F6.x-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-emerald.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Double--Entry](https://img.shields.io/badge/Double--Entry-Immutable-orange.svg)]()

> A bank-grade conversational financial platform enabling customers to securely transact via WhatsApp natural language and voice messages, backed by a strict double-entry ledger, explicit 11-state finite state machine, and administrative oversight.

---

## 🏛️ Architectural Principles & Core Guarantees

1. **Double-Entry General Ledger (Chart of Accounts)**
   - No single mutable balance column is treated as authoritative truth.
   - Every financial movement posts balanced debits and credits:
     $$\sum \text{Debits} \equiv \sum \text{Credits}$$
   - Immutable postings: entries and journals cannot be edited or deleted in-place. Compensating reversal journals are required.
   - All amounts are stored as integer minor units (`Kobo`, where $1\text{ NGN} = 100\text{ Kobo}$) as `BigInt` to eliminate IEEE 754 floating-point inaccuracies.

2. **Transaction State Machine (11 Deterministic States)**
   - `CREATED` $\rightarrow$ `VALIDATING` $\rightarrow$ `AWAITING_AUTHORIZATION` $\rightarrow$ `AUTHORIZED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SUCCESSFUL` | `FAILED` | `PENDING` $\rightarrow$ `REQUIRES_RECONCILIATION` $\rightarrow$ `REVERSED` | `CANCELLED`.
   - Transitions are centrally enforced; illegal jumps are prevented at the domain model level.
   - Network timeouts on provider calls transition transactions to `PENDING` rather than `FAILED`, preventing duplicate payouts.

3. **Sandboxed AI Entity & Intent Engine**
   - Natural language and voice transcripts are parsed into structured proposals.
   - The AI has **zero execution authority** and no direct database access.
   - Every intent proposal is independently validated against KYC limits and ledger balances by core backend application services.

4. **Security & Channel Authentication**
   - WhatsApp phone numbers are not treated as sufficient transaction authorization.
   - High-risk operations (transfers, VAS above threshold) require an active 5-minute single-use challenge token and customer transaction PIN verified with memory-hard **Argon2id** (`m=65536, t=3, p=4`).
   - 3 consecutive failed PIN attempts trigger a 30-minute lockout.
   - Administrator dashboard access enforces RBAC and mandatory TOTP MFA.

---

## 📁 Repository Structure

```
src/
├── app.module.ts                         # Root application module
├── main.ts                               # Bootstrap, Swagger, pipes & exception filters
│
├── common/                               # Cross-cutting utilities & bank invariants
│   ├── constants/                        # Chart of accounts, limits, error codes
│   ├── exceptions/                       # Domain exceptions (FinancialInvariant, InsufficientFunds, etc.)
│   ├── filters/                          # Global sanitized exception filter
│   └── types/                            # Kobo minor-unit formatting & arithmetic helpers
│
├── config/                               # Strict environment validation gates
│   ├── configuration.ts
│   └── validation.ts
│
├── infrastructure/                       # Persistence & External adapters
│   └── database/                         # Prisma ORM service & module
│
├── contracts/                            # Formal provider contracts
│   ├── ai/                               # IAIProvider contract & financial intent enums
│   └── financial/                        # IFinancialProvider contract & response schemas
│
└── modules/                              # Decoupled Domain Modules
    ├── administrators/                   # Admin endpoints & metrics (Zero customer access)
    ├── artificial-intelligence/          # Sandboxed NLP intent & entity parser
    ├── authentication/                   # Argon2id hashing, PIN verification, JWT & RBAC guards
    ├── customers/                        # Customer profiles, KYC tiers, status management
    ├── financial-providers/              # Sandbox provider adapter & payout simulator
    ├── ledger/                           # Double-entry ledger engine & zero-sum audits
    ├── messaging/                        # Outbound WhatsApp dispatcher & conversation router
    ├── recipients/                       # Saved recipients & alias disambiguation
    ├── reconciliation/                   # 3-way reconciliation engine
    ├── transactions/                     # 11-state FSM & two-phase fund reservation
    └── webhooks/                         # HMAC-SHA256 verified Meta Cloud API ingestion
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+ / v24+
- PostgreSQL 15+ / 16+
- Redis 7+

### 1. Installation
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `IS_SIMULATED=true` during development.

### 3. Generate Database Client & Run Tests
```bash
npx prisma generate
npm test
```

### 4. Build & Start the Service
```bash
npm run build
npm start
```
- API Base: `http://localhost:3000/api/v1`
- Swagger Documentation: `http://localhost:3000/docs`

---

## 🧪 Automated Bank Invariant Tests

Run the test suite:
```bash
npm test
```
The test suite validates:
- **Zero-Sum Mathematical Invariant:** Rejection of any journal where $\sum \text{Debits} \neq \sum \text{Credits}$.
- **Customer Overdraw Protection:** Rejection of transfers exceeding available balance.
- **Strict State Transitions:** Prohibition of direct `CREATED` $\rightarrow$ `SUCCESSFUL` or `SUCCESSFUL` $\rightarrow$ `FAILED` transitions.
- **Idempotency Replay Safety:** Repeated execution requests return the existing journal without double-posting.
- **Conversational Entity Parsing:** Clean extraction of amounts, NGN multipliers (e.g., `5k`), and recipient aliases.
"# wappay" 
