# 05. FINANCIAL PROVIDER ABSTRACTION & CONTRACTS
## WAPPay Conversational Financial Platform — Phase 1 Technical Design

---

## 1. Provider Abstraction Principle

To prevent vendor lock-in and decouple core domain logic from provider-specific API nuances, the application communicates with financial rails exclusively through formal internal TypeScript interfaces (`contracts/financial/`).

### Architectural Benefits:
1. **Hot-Swappable Rails:** The system can route high-volume traffic to Provider A (e.g. Paystack) and fallback to Provider B (e.g. Flutterwave or Monnify) without changing transaction or ledger services.
2. **Hermetic Sandbox Testing:** In development and staging, a full-fidelity `SandboxProviderAdapter` executes deterministic tests (simulating timeouts, delayed webhooks, bank rejections) without incurring real-world costs or regulatory risks.
3. **No Leaky Abstractions:** Provider-specific payload fields, bank codes, and response codes are normalized into standard platform DTOs inside the adapter.

---

## 2. Core Provider Interface Contract

```typescript
export interface ResolveAccountDto {
  accountNumber: string; // 10-digit NUBAN
  bankCode: string;      // 3 or 6 digit CBN institution code
}

export interface AccountResolutionResult {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  isVerified: boolean;
}

export interface InitiateTransferDto {
  internalReference: string;
  idempotencyKey: string;
  amountKobo: bigint;
  currency: string;
  destinationAccountNumber: string;
  destinationBankCode: string;
  destinationAccountName: string;
  narration: string;
}

export interface ProviderTransferResponse {
  providerReference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
  feeKobo: bigint;
  settlementDate?: Date;
  rawResponse?: Record<string, unknown>;
}

export interface ProviderStatusResponse {
  providerReference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  amountKobo: bigint;
  isSettled: boolean;
  message?: string;
}

export interface IFinancialProvider {
  readonly providerName: string;
  readonly isSandbox: boolean;

  resolveAccount(dto: ResolveAccountDto): Promise<AccountResolutionResult>;
  initiateTransfer(dto: InitiateTransferDto): Promise<ProviderTransferResponse>;
  getTransactionStatus(providerReference: string): Promise<ProviderStatusResponse>;
}
```

---

## 3. Real vs. Simulated Provider Capabilities

| Operation | Real Provider Capability (e.g. NIBSS / Paystack / Monnify) | Sandbox Provider Behavior |
| :--- | :--- | :--- |
| **Name Enquiry** | Queries NIBSS Instant Payment (NIP) central switch. Returns authoritative account name. | Deterministic mock: maps 10-digit numbers to realistic test names ("Jane Adeleke"). |
| **Instant Payout** | Submits credit instruction to destination commercial bank via NIP rails. Settles in seconds. | Returns simulated reference `SIM_PAYOUT_...`. Supports test amounts ending in `99` (PENDING) and `98` (FAILED). |
| **Status Enquiry** | Queries clearing switch for terminal outcome of in-flight transfers. | Returns confirmed settled state for simulated references. |
| **Webhooks** | Emits signed HMAC-SHA512 events when clearing confirmation arrives from destination bank. | Emits simulated webhook payloads for end-to-end integration testing. |

---

## 4. Safety Gates & Environment Isolation

> [!IMPORTANT]
> **Production Safety Gating:**
> 1. `IS_SIMULATED: true` is hardcoded as default in all baseline configurations.
> 2. Disabling `IS_SIMULATED` requires setting `NODE_ENV=production`, valid vault-managed secret keys, and verified partner sponsorship agreements.
> 3. The codebase contains an explicit runtime assertion preventing sandbox test keys from executing if `IS_SIMULATED=false`.
