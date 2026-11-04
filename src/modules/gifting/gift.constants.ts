export type GiftKind = 'AIRTIME' | 'DATA' | 'MONEY';

export type GiftTier = 'Starter' | 'Deluxe' | 'Elite';

export interface GiftCatalogItem {
  id: string;
  kind: GiftKind;
  tier: GiftTier;
  name: string;
  description: string;
  amountKobo: bigint;
  plan?: string;
}

export const GIFT_KINDS: Record<
  GiftKind,
  { label: string; emoji: string; sectionTitle: string }
> = {
  AIRTIME: { label: 'Airtime', emoji: '📱', sectionTitle: 'Airtime Gifts' },
  DATA: { label: 'Data', emoji: '🌐', sectionTitle: 'Data Gifts' },
  MONEY: { label: 'Money', emoji: '💸', sectionTitle: 'Money Gifts' },
};

/**
 * WhatsApp gift catalog.
 * Keep `name` at or below 24 characters so it fits Meta list row titles.
 */
export const GIFT_CATALOG: readonly GiftCatalogItem[] = [
  {
    id: 'GIFT_A1',
    kind: 'AIRTIME',
    tier: 'Starter',
    name: 'Starter Airtime',
    description: '₦1,000 airtime • Instant delivery',
    amountKobo: 100_000n,
  },
  {
    id: 'GIFT_A2',
    kind: 'AIRTIME',
    tier: 'Deluxe',
    name: 'Deluxe Airtime',
    description: '₦4,000 airtime • Instant delivery',
    amountKobo: 400_000n,
  },
  {
    id: 'GIFT_A3',
    kind: 'AIRTIME',
    tier: 'Elite',
    name: 'Elite Airtime',
    description: '₦10,000 airtime • Instant delivery',
    amountKobo: 1_000_000n,
  },
  {
    id: 'GIFT_D1',
    kind: 'DATA',
    tier: 'Starter',
    name: 'Starter Data',
    description: '₦1,000 • 1.5GB data bundle',
    amountKobo: 100_000n,
    plan: '1.5GB',
  },
  {
    id: 'GIFT_D2',
    kind: 'DATA',
    tier: 'Deluxe',
    name: 'Deluxe Data',
    description: '₦4,000 • 6GB data bundle',
    amountKobo: 400_000n,
    plan: '6GB',
  },
  {
    id: 'GIFT_D3',
    kind: 'DATA',
    tier: 'Elite',
    name: 'Elite Data',
    description: '₦10,000 • 15GB data bundle',
    amountKobo: 1_000_000n,
    plan: '15GB',
  },
  {
    id: 'GIFT_M1',
    kind: 'MONEY',
    tier: 'Starter',
    name: 'Starter Money',
    description: '₦1,000 cash • Claim to wallet',
    amountKobo: 100_000n,
  },
  {
    id: 'GIFT_M2',
    kind: 'MONEY',
    tier: 'Deluxe',
    name: 'Deluxe Money',
    description: '₦4,000 cash • Claim to wallet',
    amountKobo: 400_000n,
  },
  {
    id: 'GIFT_M3',
    kind: 'MONEY',
    tier: 'Elite',
    name: 'Elite Money',
    description: '₦10,000 cash • Claim to wallet',
    amountKobo: 1_000_000n,
  },
];

export function resolveGiftCatalogItem(input: string): GiftCatalogItem | undefined {
  const raw = input.trim().toLowerCase();

  const byId = GIFT_CATALOG.find((gift) => gift.id.toLowerCase() === raw);
  if (byId) {
    return byId;
  }

  const indexMatch = raw.match(/^(?:gift[_ -]?)?([1-9])$/);
  if (indexMatch) {
    return GIFT_CATALOG[Number(indexMatch[1]) - 1];
  }

  return GIFT_CATALOG.find(
    (gift) =>
      gift.name.toLowerCase() === raw ||
      gift.name.toLowerCase().includes(raw),
  );
}
