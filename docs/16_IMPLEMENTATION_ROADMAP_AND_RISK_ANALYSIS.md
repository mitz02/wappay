# 16. PHASED IMPLEMENTATION ROADMAP & RISK ANALYSIS
## WAPPay Conversational Financial Platform — Phase 1 Technical Design

---

## 1. Phased Implementation Roadmap

```mermaid
gantt
    title WAPPay Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Architecture & Design
    System Architecture & Technical Design   :done, p1, 2026-11-01, 2026-11-02
    section Phase 2: Core Banking Foundation
    Database Schema & Migrations (PostgreSQL/Prisma) :active, p2_1, 2026-11-03, 2026-11-05
    Double-Entry Ledger Subsystem & Invariant Tests  :p2_2, 2026-11-06, 2026-11-08
    Customer Auth, Argon2id PIN & Lockout Engine     :p2_3, 2026-11-09, 2026-11-11
    section Phase 3: Transaction & Rail Integrations
    11-State Machine & Fund Reservation Pipeline     :p3_1, 2026-11-12, 2026-11-15
    Financial Provider Sandbox & Name Enquiry        :p3_2, 2026-11-16, 2026-11-18
    Recipient Management & Disambiguation Engine     :p3_3, 2026-11-19, 2026-11-21
    section Phase 4: Conversational AI & Channels
    Conversational AI Intent Parser & Sanitizer      :p4_1, 2026-11-22, 2026-11-25
    Voice-Note Processing & Audio Normalization      :p4_2, 2026-11-26, 2026-11-28
    Meta WhatsApp Cloud API Webhook Ingestion        :p4_3, 2026-11-29, 2026-12-02
    section Phase 5: Operations & Administration
    Automated 3-Way Reconciliation Engine            :p5_1, 2026-12-03, 2026-12-06
    Next.js Admin Operations Dashboard & Audit Logs  :p5_2, 2026-12-07, 2026-12-10
    section Phase 6: Audits & Production Readiness
    End-to-End Sandbox Simulation & Invariant Proofs :p6_1, 2026-12-11, 2026-12-14
    Independent Security & Penetration Testing Audit :p6_2, 2026-12-15, 2026-12-20
```

---

## 2. Identified Missing Requirements & Business Decisions

Before beginning live integration, the following non-technical business decisions must be resolved:

### 1. Legal Custody & Safeguarding Arrangement
- **Question:** Which licensed institution (e.g. Providus Bank, Wema Bank, Sterling Bank) will hold customer funds?
- **Impact on Architecture:** Determines whether the platform issues individual dedicated virtual accounts (NUBANs) tied to customer BVNs, or pooled omnibus virtual accounts.

### 2. Tiered KYC & Daily Transaction Limits
- **Question:** What are the exact transaction caps for Tier-1 (Phone number only) vs. Tier-2 (BVN/NIN verified) vs. Tier-3 (Address verified)?
- **Impact on Architecture:** In the current design, default daily limits are set to ₦500,000 for Tier-1; specific partner compliance mandates may require lower thresholds (e.g. ₦50,000).

### 3. Interchange Fee Structure
- **Question:** Are transfer fees fixed (e.g. ₦10 flat) or tiered based on transaction volume (e.g. ₦10 below ₦5,000; ₦25 between ₦5,001–₦50,000; ₦50 above ₦50,000)?
- **Impact on Architecture:** Fee calculation services must load tiered fee schedules dynamically from database configuration.

### 4. Dispute & Chargeback Windows
- **Question:** What is the legal dispute settlement window for fraudulent WhatsApp SIM swaps (e.g. 72 hours vs 14 days)?
- **Impact on Architecture:** Governs the retention duration of reserved funds in suspense accounts before final platform settlement.

---

## 3. Regulatory & Operational Risk Analysis

| Risk Category | Specific Exposure | Architectural Mitigation |
| :--- | :--- | :--- |
| **Regulatory (CBN)** | Operating an unlicensed stored-value wallet in Nigeria. | All funds are routed through the licensed partner bank. Internal ledgers mirror custodial escrow accounts. |
| **Data Protection (NDPR)** | Customer financial history leaked via WhatsApp or web logs. | End-to-end TLS 1.3, PII redaction interceptors, and Argon2id memory-hard hashing. |
| **Fraud (SIM Swap)** | Fraudster gains access to victim's WhatsApp account and transfers funds. | A WhatsApp message alone cannot move money; a separate 4-digit transaction PIN with 3-attempt lockout is required. |
| **Operational Drift** | Database balances diverge from external bank balances due to network blips. | Continuous automated 3-way reconciliation alerts operators to any ledger variance. |
