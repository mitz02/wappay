# 03. DOUBLE-ENTRY ACCOUNTING LEDGER ARCHITECTURE
## WAPPay Conversational Financial Platform — Phase 1 Technical Design

---

## 1. Accounting Philosophy & Need for a General Ledger

In conventional applications, account balances are often represented as a single mutable column:
```sql
-- DANGEROUS PATTERN (PROHIBITED IN WAPPAY)
UPDATE accounts SET balance = balance - 5000 WHERE id = 'cust_123';
```
This pattern creates catastrophic failure modes:
1. **Zero Traceability:** If a balance changes from ₦100,000 to ₦95,000, there is no intrinsic mathematical proof explaining *why* it changed, *who* authorized it, or *where* the counterpart funds went.
2. **Race Conditions:** Simultaneous concurrent requests can read stale balances and create negative balances.
3. **Audit Failure:** External auditors and central bank regulators require balanced trial sheets.

WAPPay implements a **proper double-entry general ledger subsystem**. Every financial movement is a balanced journal containing at least two offsetting entries:
$$\sum \text{Debits} \equiv \sum \text{Credits}$$

---

## 2. Standard Chart of Accounts (COA)

```
10000 - ASSETS
  11100 - Partner Settlement Escrow (Real funds held at licensed Partner Bank)
  11200 - Provider Clearing Account (Funds in transit to/from external clearing rails)
20000 - LIABILITIES
  21000 - Customer Stored Deposits Pool (Internal customer available balances)
  21000-CUST-{id} - Individual Customer Available Deposit Sub-Account
  21100 - Customer Reserved Funds Pool (Funds locked for active pending transfers)
  22000 - General Suspense Account (Unmatched or ambiguous transaction funds)
30000 - EQUITY
  31000 - Platform Retained Reserves
40000 - REVENUE
  41000 - Transaction Processing Fee Revenue
  42000 - Airtime & VAS Commission Revenue
50000 - EXPENSES
  51000 - Provider Network Interchange & Transfer Costs
```

---

## 3. Account Normal Balances & Mutation Rules

The ledger follows classical accounting conventions:

| Account Type | Normal Balance | Debit ($\text{Dr}$) Impact | Credit ($\text{Cr}$) Impact |
| :--- | :--- | :--- | :--- |
| **Asset (10000)** | Debit | **Increases** Balance ($+\Delta$) | **Decreases** Balance ($-\Delta$) |
| **Liability (20000)** | Credit | **Decreases** Balance ($-\Delta$) | **Increases** Balance ($+\Delta$) |
| **Equity (30000)** | Credit | **Decreases** Balance ($-\Delta$) | **Increases** Balance ($+\Delta$) |
| **Revenue (40000)** | Credit | **Decreases** Balance ($-\Delta$) | **Increases** Balance ($+\Delta$) |
| **Expense (50000)** | Debit | **Increases** Balance ($+\Delta$) | **Decreases** Balance ($-\Delta$) |

### Customer Deposit Calculation Rule
A customer's balance is a **Liability** of the platform (money owed to the customer).
- When a customer deposits funds $\rightarrow$ **Credit** `21000-CUST-...` ($+\text{Balance}$).
- When a customer initiates a transfer $\rightarrow$ **Debit** `21000-CUST-...` ($-\text{Balance}$).

---

## 4. End-to-End Journal Posting Examples

### Scenario A: Outbound Transfer of ₦5,000 with ₦10 Platform Fee

#### Step 1: Fund Reservation (Pre-flight Phase)
Upon customer PIN authorization, funds are locked in the reserved liability pool:
- **Debit:** `21000-CUST-1` (Customer Deposit): ₦5,010 (501,000 Kobo) $\rightarrow$ *Reduces available balance*
- **Credit:** `21100` (Customer Reserved Pool): ₦5,010 (501,000 Kobo) $\rightarrow$ *Holds funds in lock*

$$\text{Total Debits} = 501,000 = \text{Total Credits} = 501,000 \quad (\Delta = 0)$$

#### Step 2: Final Settlement (Upon Provider Success)
Once the provider confirms successful transfer execution:
- **Debit:** `21100` (Customer Reserved Pool): ₦5,010 (501,000 Kobo) $\rightarrow$ *Clears reservation*
- **Credit:** `11200` (Provider Clearing Account): ₦5,000 (500,000 Kobo) $\rightarrow$ *Settles rail liability*
- **Credit:** `41000` (Transaction Fee Revenue): ₦10 (1,000 Kobo) $\rightarrow$ *Records platform income*

$$\text{Total Debits} = 501,000 = \text{Total Credits} = (500,000 + 1,000) = 501,000 \quad (\Delta = 0)$$

#### Step 3: Rollback on Synchronous Failure
If the provider rejects the transfer (e.g. invalid account):
- **Debit:** `21100` (Customer Reserved Pool): ₦5,010
- **Credit:** `21000-CUST-1` (Customer Deposit): ₦5,010 $\rightarrow$ *Restores available balance*

$$\text{Total Debits} = 501,000 = \text{Total Credits} = 501,000 \quad (\Delta = 0)$$

---

## 5. Ledger Invariants & Audit Guarantees

1. **Atomic Isolation:** All postings occur within a PostgreSQL transaction with pessimistic row-locking (`SELECT ... FOR UPDATE` on `ledger_accounts`).
2. **Negative Balance Guard:** If a debit on a customer deposit account would result in $balance < 0$, the transaction is aborted with `FinancialInvariantException`.
3. **Zero In-Place Edits:** Posted journals have status `POSTED`. If a transaction must be corrected or reversed, a compensating journal with status `REVERSED` is posted, cross-referencing `reversalReference = originalReference`.
4. **Independent Audit Invariant:**
   At any time, running a system-wide reconciliation:
   $$\sum \text{All Ledger Entries with Direction 'DEBIT'} - \sum \text{All Ledger Entries with Direction 'CREDIT'} \equiv 0$$
   Any non-zero discrepancy immediately halts automated payouts and alerts the security team.
