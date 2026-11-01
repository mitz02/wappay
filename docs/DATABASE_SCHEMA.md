# DATABASE SCHEMA SPECIFICATION
## WAPPay Relational Data Model

---

### Core Data Integrity Rules
1. **Precision & Minor Units:** All monetary columns (`amountKobo`, `feeKobo`, `balanceKobo`, `dailyLimitKobo`) use PostgreSQL `BIGINT` representing integer Kobo ($1\text{ NGN} = 100\text{ Kobo}$) to prevent IEEE 754 floating-point inaccuracies.
2. **Foreign Key Integrity:** Cascading deletes are strictly restricted to child metadata; financial journals and entries are immutable and cascade-protected.
3. **Optimistic Locking:** Financial records include `updatedAt` and version stamps.

### Table Summary
- `users`: Universal identity table.
- `admin_profiles`: Administrator credentials and MFA secret metadata.
- `customer_profiles`: WhatsApp-linked customer KYC and Argon2id PIN hashes.
- `recipients`: Saved bank destination accounts (NUBAN + Bank Code).
- `recipient_aliases`: Normalized lowercase aliases ("mum", "wife", etc.).
- `ledger_accounts`: Chart of accounts and materialized account balances.
- `ledger_journals`: Immutable journal headers with idempotency keys.
- `ledger_entries`: Atomic debit and credit legs with balance snapshots.
- `transactions`: 11-state transaction lifecycle records.
- `transaction_events`: Immutable state transition timeline audit log.
- `transaction_authorizations`: Single-use PIN challenge tokens.
- `webhook_inbox`: Transactional inbox for deduplication and replay safety.
- `audit_logs`: Immutable administrator and security action records.
- `reconciliation_runs`: Automated 3-way reconciliation audit reports.
