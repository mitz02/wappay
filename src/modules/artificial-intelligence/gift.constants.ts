export type GiftKind = 'AIRTIME' | 'DATA' | 'CASH';

export interface GiftCatalogItem {
  id: string;
  kind: GiftKind;
  name: string;
  description: string;
  amountKobo: bigint;
  network?: string;
  plan?: string;
}

/**
 * WhatsApp gift shop catalog.
 * Keep `name` at or below 24 characters so it fits Meta list row titles.
 */
export const GIFT_CATALOG: readonly GiftCatalogItem[] = [
  {
    id: 'GIFT_1',
    kind: 'AIRTIME',
    name: 'MTN ₦500 Airtime',
    description: 'Instant MTN top-up with 3% cashback',
    amountKobo: 50_000n,
    network: 'MTN',
  },
  {
    id: 'GIFT_2',
    kind: 'AIRTIME',
    name: 'MTN ₦1,000 Airtime',
    description: 'Instant MTN top-up with 3% cashback',
    amountKobo: 100_000n,
    network: 'MTN',
  },
  {
    id: 'GIFT_3',
    kind: 'AIRTIME',
    name: 'MTN ₦2,000 Airtime',
    description: 'Instant MTN top-up with 3% cashback',
    amountKobo: 200_000n,
    network: 'MTN',
  },
  {
    id: 'GIFT_4',
    kind: 'AIRTIME',
    name: 'Airtel ₦1,000 Airtime',
    description: 'Instant Airtel top-up with 3% cashback',
    amountKobo: 100_000n,
    network: 'AIRTEL',
  },
  {
    id: 'GIFT_5',
    kind: 'AIRTIME',
    name: 'Airtel ₦2,000 Airtime',
    description: 'Instant Airtel top-up with 3% cashback',
    amountKobo: 200_000n,
    network: 'AIRTEL',
  },
  {
    id: 'GIFT_6',
    kind: 'DATA',
    name: 'MTN ₦1,000 1.5GB Data',
    description: '1.5GB data bundle delivered instantly',
    amountKobo: 100_000n,
    network: 'MTN',
    plan: '1.5GB',
  },
  {
    id: 'GIFT_7',
    kind: 'DATA',
    name: 'MTN ₦2,500 4.5GB Data',
    description: '4.5GB data bundle delivered instantly',
    amountKobo: 250_000n,
    network: 'MTN',
    plan: '4.5GB',
  },
  {
    id: 'GIFT_8',
    kind: 'DATA',
    name: 'Airtel ₦1,500 2GB Data',
    description: '2GB data bundle delivered instantly',
    amountKobo: 150_000n,
    network: 'AIRTEL',
    plan: '2GB',
  },
  {
    id: 'GIFT_9',
    kind: 'CASH',
    name: '₦5,000 Cash Gift',
    description: 'Send cash to their WAPPay wallet',
    amountKobo: 500_000n,
  },
];
