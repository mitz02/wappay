// Constants for Mock Financial Environment & Simulation

export const MOCK_FINANCIAL_CONSTANTS = {
  SIMULATED_BANK_NAME: 'WAPPay Mock Bank',
  SIMULATED_BANK_CODE: '999',
  DEFAULT_TRANSFER_FEE_KOBO: 1_000n, // 10 NGN
  CONFIRMATION_EXPIRY_MINUTES: 5,
  MAX_DAILY_LIMIT_KOBO: 50_000_000n, // 500,000 NGN
} as const;

export const MOCK_VAS_PACKAGES = {
  NETWORKS: ['MTN', 'AIRTEL', 'GLO', '9MOBILE'] as const,
  AIRTIME_AMOUNTS: [
    { label: '₦500', kobo: 50_000n },
    { label: '₦1,000', kobo: 100_000n },
    { label: '₦2,000', kobo: 200_000n },
    { label: '₦5,000', kobo: 500_000n },
  ],
  DATA_BUNDLES: [
    { code: '1GB', label: '1GB Data (30 Days)', kobo: 50_000n },
    { code: '2GB', label: '2GB Data (30 Days)', kobo: 100_000n },
    { code: '5GB', label: '5GB Data (30 Days)', kobo: 250_000n },
    { code: '10GB', label: '10GB Data (30 Days)', kobo: 500_000n },
  ],
} as const;

export const MOCK_BANKS: Record<string, string> = {
  '058': 'Guaranty Trust Bank',
  '011': 'First Bank of Nigeria',
  '033': 'United Bank for Africa',
  '057': 'Zenith Bank',
  '044': 'Access Bank',
  '035': 'Wema Bank',
  '999': 'WAPPay Mock Bank',
};
