# DOUBLE-ENTRY LEDGER DESIGN & FINANCIAL INVARIANTS
## WAPPay Accounting Subsystem

---

### 1. Chart of Accounts (COA) Structure
```
10000 - ASSETS
  11100 - Partner Settlement Escrow (Real funds at Partner Bank)
  11200 - Provider Clearing Account (Funds in transit to/from rails)
20000 - LIABILITIES
  21000 - Customer Stored Deposits (Customer available funds pool)
  21100 - Customer Reserved Funds (Locked for active pending transfers)
  22000 - Suspense Account (Unmatched or ambiguous transaction funds)
30000 - EQUITY
  31000 - Retained Reserves
40000 - REVENUE
  41000 - Transaction Processing Fee Revenue
  42000 - Airtime/VAS Commission Revenue
50000 - EXPENSES
  51000 - Provider Transfer Costs & Network Interchange Fees
```

### 2. Fundamental Invariants
1. **Zero-Sum Balance Rule:**
   For every journal $J$:
   $$\sum_{e \in J, e.dir = \text{DEBIT}} e.amount \equiv \sum_{e \in J, e.dir = \text{CREDIT}} e.amount$$
2. **Account Sign Conventions:**
   - **Assets & Expenses:** Debit increases balance, Credit decreases balance.
   - **Liabilities, Equity, Revenue:** Credit increases balance, Debit decreases balance.
3. **No Overdrafts on Customer Deposits:**
   A debit on account `21000-CUST-...` that results in $balance < 0$ throws `FinancialInvariantException` and rolls back the database transaction.
4. **Immutability & Audit Trail:**
   `UPDATE` and `DELETE` queries on `ledger_journals` and `ledger_entries` are prohibited. Compensating journals with explicit reversal references must be posted.
