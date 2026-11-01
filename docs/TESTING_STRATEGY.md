# TESTING STRATEGY & FINANCIAL INVARIANT VERIFICATION
## WAPPay Automated Testing Standard

---

### 1. Mandatory Invariant Testing
In banking applications, HTTP 200 is not proof of correctness. The automated test suite enforces the following invariants:
1. **Mathematical Invariant:** $\sum \text{Debits} \equiv \sum \text{Credits}$ across all journals.
2. **Strict Non-Negative Balance:** Customer deposits liability accounts can never dip below zero.
3. **Idempotency Guarantee:** Replaying the same idempotency key returns the existing transaction record without duplicate balance mutations.
4. **State Machine Integrity:** Prohibits illegal transitions (e.g. `CREATED` $\rightarrow$ `SUCCESSFUL`, `SUCCESSFUL` $\rightarrow$ `FAILED`).
5. **Two-Phase Reservation:** Verifies funds are reserved before provider dispatch, and unreserved upon synchronous rejection.

### 2. Test Execution
```bash
# Run all unit, invariant, and end-to-end sandbox tests
npm test
```
All 15 test suites and end-to-end scenarios execute within CI/CD before any deployment.
