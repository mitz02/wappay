// Constants for Mock Financial Environment & Simulation

export const MOCK_FINANCIAL_CONSTANTS = {
  SIMULATED_BANK_NAME: 'WAPPay Mock Bank',
  SIMULATED_BANK_CODE: '999',
  DEFAULT_TRANSFER_FEE_KOBO: 1_000n, // 10 NGN
  CONFIRMATION_EXPIRY_MINUTES: 5,
  MAX_DAILY_LIMIT_KOBO: 50_000_000n, // 500,000 NGN
  INITIAL_STARTER_BALANCE_KOBO: 250_000_00n, // 250,000 NGN starter test balance
  CROSS_BORDER_FEE_KOBO: {
    AFRICA: 2_000_00n, // 2,000 NGN
    CHINA: 5_000_00n, // 5,000 NGN
  },
} as const;

export type MockPaymentDestinationType = 'AFRICA' | 'CHINA' | 'VENDOR';

export interface MockCorridor {
  /** ISO country name shown to the customer */
  country: string;
  /** ISO alpha-2 code used to build the simulated account number */
  iso: string;
  /** Foreign currency the recipient receives */
  currency: string;
  /** WhatsApp flag emoji for the destination */
  flag: string;
  /** Simulated foreign units received per 1 NGN sent */
  perNaira: number;
  /** Human rail label stored as destinationBankCode for display */
  railLabel: string;
  /** Lowercase keywords that trigger this corridor in the intent parser */
  keywords: string[];
}

/**
 * Simulated cross-border corridors (Africa + China) with mock FX rates.
 * Rates are fixed mock values — no real market data is used.
 */
export const MOCK_CORRIDORS: Record<string, MockCorridor> = {
  CAMEROON: {
    country: 'Cameroon', iso: 'CM', currency: 'XAF', flag: '🇨🇲',
    perNaira: 0.385, railLabel: 'Cameroon · XAF Rail',
    keywords: ['cameroon', 'cameroonian'],
  },
  GHANA: {
    country: 'Ghana', iso: 'GH', currency: 'GHS', flag: '🇬🇭',
    perNaira: 1 / 95, railLabel: 'Ghana · GHS Rail',
    keywords: ['ghana', 'ghanaian'],
  },
  KENYA: {
    country: 'Kenya', iso: 'KE', currency: 'KES', flag: '🇰🇪',
    perNaira: 1 / 12, railLabel: 'Kenya · KES Rail',
    keywords: ['kenya', 'kenyan'],
  },
  SOUTH_AFRICA: {
    country: 'South Africa', iso: 'ZA', currency: 'ZAR', flag: '🇿🇦',
    perNaira: 1 / 85, railLabel: 'South Africa · ZAR Rail',
    keywords: ['south africa', 'south african'],
  },
  UGANDA: {
    country: 'Uganda', iso: 'UG', currency: 'UGX', flag: '🇺🇬',
    perNaira: 2.4, railLabel: 'Uganda · UGX Rail',
    keywords: ['uganda', 'ugandan'],
  },
  TANZANIA: {
    country: 'Tanzania', iso: 'TZ', currency: 'TZS', flag: '🇹🇿',
    perNaira: 1.7, railLabel: 'Tanzania · TZS Rail',
    keywords: ['tanzania', 'tanzanian'],
  },
  IVORY_COAST: {
    country: "Côte d'Ivoire", iso: 'CI', currency: 'XAF', flag: '🇨🇮',
    perNaira: 0.385, railLabel: "Côte d'Ivoire · XAF Rail",
    keywords: ["côte d'ivoire", "cote d'ivoire", 'cote divoire', 'ivory coast'],
  },
  SENEGAL: {
    country: 'Senegal', iso: 'SN', currency: 'XAF', flag: '🇸🇳',
    perNaira: 0.385, railLabel: 'Senegal · XAF Rail',
    keywords: ['senegal', 'senegalese'],
  },
  RWANDA: {
    country: 'Rwanda', iso: 'RW', currency: 'RWF', flag: '🇷🇼',
    perNaira: 1.15, railLabel: 'Rwanda · RWF Rail',
    keywords: ['rwanda', 'rwandan'],
  },
  CHINA: {
    country: 'China', iso: 'CN', currency: 'CNY', flag: '🇨🇳',
    perNaira: 1 / 210, railLabel: 'China · CNY Rail',
    keywords: ['china', 'chinese', 'cny', 'yuan', 'renminbi'],
  },
};

/** Finds a non-China African corridor whose keywords appear in the message. */
export function findAfricanCorridor(lowerMessage: string): MockCorridor | undefined {
  for (const [key, corridor] of Object.entries(MOCK_CORRIDORS)) {
    if (key === 'CHINA') continue;
    if (corridor.keywords.some((k) => lowerMessage.includes(k))) {
      return corridor;
    }
  }
  return undefined;
}

/** Resolves a corridor by destination type + optional country name. */
export function resolveCorridor(
  destinationType: MockPaymentDestinationType,
  country?: string,
): MockCorridor | undefined {
  if (destinationType === 'VENDOR') return undefined;
  if (destinationType === 'CHINA') return MOCK_CORRIDORS.CHINA;
  if (country) {
    const needle = country.toLowerCase();
    const match = Object.values(MOCK_CORRIDORS).find(
      (c) => c.country.toLowerCase() === needle || c.keywords.includes(needle),
    );
    if (match) return match;
  }
  return undefined;
}

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
