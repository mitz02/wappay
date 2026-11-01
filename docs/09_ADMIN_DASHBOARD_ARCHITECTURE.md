# 09. WEB ADMINISTRATOR DASHBOARD ARCHITECTURE
## WAPPay Conversational Financial Platform — Phase 1 Technical Design

---

## 1. Strict Boundary Principle: Admin Exclusivity

> [!CAUTION]
> **Fintech Rule: Zero Customer Web Surface**
> The web application is engineered exclusively for platform administrators, financial operators, and compliance auditors.
> - There is **NO** customer registration page, customer login page, customer financial dashboard, or customer wallet on the web application.
> - All customer interactions occur exclusively via WhatsApp text and voice channels.
> - Attempting to access administrative pages without valid JWT + MFA credentials results in immediate redirection to `/login`.

---

## 2. Dashboard Technical Stack
- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript.
- **Styling:** Tailwind CSS with high-contrast, accessible dark mode palette designed for high-density financial monitoring.
- **Icons & Componentry:** Lucide React icons with responsive, keyboard-navigable tables and modal overlays.
- **State & Data Fetching:** React Server Components (RSC) for initial page loads with SWR / TanStack Query for polling active transaction streams.

---

## 3. Core Functional Views

### 3.1 Operations Overview
- **Active Customers:** Authoritative count from `customer_profiles.count({ where: { status: 'ACTIVE' } })`.
- **24-Hour Settled Volume:** Sum of `amountKobo` from `transactions.findMany({ where: { state: 'SUCCESSFUL', createdAt >= 24h } })`.
- **Pending Network Polls:** Real-time count of transactions currently in `PENDING` state awaiting bank clearing confirmation.
- **Reconciliation Health Badge:** `MATCHED` (Green) or `DISCREPANCIES_FOUND` (Red alert).

### 3.2 Customer Management
- Paginated customer directory with search by name, phone number, or virtual account number.
- PII masking by default (e.g. `+234 801 *** 5678`).
- Administrative status modification (`SUSPENDED`, `RESTRICTED`) requiring a mandatory audit reason.

### 3.3 Transaction & Event Timeline
- Filter by transaction state (`SUCCESSFUL`, `PROCESSING`, `PENDING`, `FAILED`, `REQUIRES_RECONCILIATION`).
- Detail view showing:
  - Exact customer instruction and WhatsApp message ID.
  - Linked ledger journal references.
  - State machine transition timeline (`fromState` $\rightarrow$ `toState` with timestamp and actor).
  - External provider reference and settlement timestamps.

### 3.4 Financial Reconciliation & Disputes
- Overview of automated reconciliation runs.
- Detailed discrepancy inspector showing mismatches between internal transactions, ledger journals, and bank settlement statements.
- One-click trigger for on-demand reconciliation window.

---

## 4. Dual-Control (Maker-Checker) Pattern
For high-impact administrative actions:
1. **Manual Ledger Adjustments / Reversals:** A `FINANCE_ADMIN` drafts the adjustment (Maker); execution is locked until a `SUPER_ADMIN` signs off (Checker).
2. **Customer Blacklisting / Asset Freezes:** An `OPERATIONS_ADMIN` proposes the suspension; compliance approval is required.
3. Every intervention logs the IP address, user agent, actor ID, and authorized justification in the immutable `audit_logs` table.
