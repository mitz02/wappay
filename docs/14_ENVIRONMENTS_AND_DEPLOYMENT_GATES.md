# 14. ENVIRONMENT ARCHITECTURE & DEPLOYMENT GATES
## WAPPay Conversational Financial Platform — Phase 1 Technical Design

---

## 1. Environment Separation Matrix

| Characteristic | Development (Local) | Staging | Production |
| :--- | :--- | :--- | :--- |
| **Hosting** | Local Docker Compose | Managed Cloud (AWS/GCP/Railway) | Multi-AZ High-Availability Managed Cluster |
| **Database** | Local PostgreSQL 16 Container | Isolated RDS PostgreSQL 16 | Multi-AZ Encrypted RDS PostgreSQL with Read Replicas |
| **Financial Rail** | `SandboxProviderAdapter` (In-Memory / Mock) | Provider Sandbox (Partner Test API Keys) | Regulated Partner Bank Live API (Vault Keys) |
| **WhatsApp Rail** | Meta Test Number / Developer Sandbox | Dedicated Staging WhatsApp Number | Verified Meta Business Account Green Badge |
| **`IS_SIMULATED` Gate**| `true` (Hardcoded) | `true` (Enforced) | `false` (Cryptographically Gated) |
| **Secret Management** | Local `.env` (Ignored in Git) | Cloud Environment Variables | AWS Secrets Manager / HashiCorp Vault |

---

## 2. Production Safety Gating Mechanism

Accidental activation of live transactions is a catastrophic financial risk. WAPPay employs **multi-tier configuration gates**:

```typescript
// Boot-time assertion in src/config/validation.ts
if (env.NODE_ENV === 'production' && env.IS_SIMULATED === false) {
  // 1. Verify Partner Sponsorship License Key
  if (!env.FINANCIAL_PARTNER_LICENSE_KEY) {
    throw new Error('FATAL: Cannot start production without verified Partner License Key');
  }
  // 2. Verify Multi-Party Signoff Token
  if (!env.PRODUCTION_DEPLOYMENT_SIGNOFF_TOKEN) {
    throw new Error('FATAL: Production mode requires a valid 2-person signoff token');
  }
}
```

A developer cannot inadvertently enable live financial operations simply by altering a single environment variable in local development.
