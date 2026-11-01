# FINANCIAL RECONCILIATION & DISPUTE RESOLUTION SPECIFICATION
## WAPPay Reconciliation Subsystem

---

### 1. Three-Way Reconciliation Architecture
Reconciliation automatically compares three independent data sources:
1. **Internal Transactions Database:** Every customer transfer instruction and state event.
2. **Double-Entry General Ledger:** Posted journal entries and account balance movements.
3. **Financial Provider Settlement Files:** External bank / provider NIP settlement reports.

### 2. Discrepancy Detection Categories
- **`MISSING_LEDGER_POSTING`:** Transaction marked `SUCCESSFUL` in database without an associated balanced settlement journal.
- **`STATUS_MISMATCH`:** Transaction marked `PENDING` internally where provider confirms `FAILED` or `SUCCESSFUL`.
- **`AMOUNT_MISMATCH`:** Difference between customer debited amount and provider settlement report.
- **`UNRESOLVED_PENDING_TIMEOUT`:** PENDING transaction that has exceeded the maximum polling interval (30 minutes).

### 3. Resolution Workflow
- Unexplained differences **must never** be corrected by silently modifying balances.
- Any adjustment requires an authorized compensatory journal entry (`REVERSAL`) signed by a `FINANCE_ADMIN` and approved by a `SUPER_ADMIN`.
