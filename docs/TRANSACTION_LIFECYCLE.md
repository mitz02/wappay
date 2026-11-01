# TRANSACTION LIFECYCLE & FINITE STATE MACHINE
## WAPPay Transaction Processing Engine

---

### 1. 11 Deterministic States
```
CREATED -> VALIDATING -> AWAITING_AUTHORIZATION -> AUTHORIZED -> PROCESSING -> SUCCESSFUL | FAILED | PENDING -> REQUIRES_RECONCILIATION -> REVERSED | CANCELLED
```

### 2. State Transition Invariants
- Direct transition from `CREATED` to `SUCCESSFUL` is forbidden.
- Network timeouts or uncertain provider API responses **must never** mark a transaction as `FAILED`. The transaction enters `PENDING`, keeping funds safely reserved in the `Customer Reserved` pool until status polling or incoming webhooks confirm the actual settlement state.
- A transaction in `SUCCESSFUL` state can only transition to `REVERSED` via an audited dual-control administrative refund/dispute workflow.

### 3. Two-Phase Execution Flow
1. **Phase 1: Fund Reservation (Pre-flight)**
   - `DEBIT 21000-CUST-...` (Customer Available Balance decreases)
   - `CREDIT 21100` (Customer Reserved Pool increases)
2. **Phase 2: Settlement Dispatch**
   - Call Financial Provider API with unique `Idempotency-Key: txn_uuid_v7`.
   - If Provider confirms `SUCCESS`:
     - `DEBIT 21100` (Customer Reserved Pool decreases)
     - `CREDIT 11200` (Provider Clearing Account increases by transfer amount)
     - `CREDIT 41000` (Transaction Fee Revenue increases by fee amount)
   - If Provider synchronously returns `FAILED`:
     - `DEBIT 21100` (Reserved Pool decreases)
     - `CREDIT 21000-CUST-...` (Customer Available Balance restored)
