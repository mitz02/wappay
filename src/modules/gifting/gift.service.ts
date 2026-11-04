import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { GiftKind } from './gift.constants';

export interface GiftLinkInput {
  id: string;
  reference: string;
  kind: GiftKind;
  name: string;
  amountKobo: bigint;
  message: string;
  senderName: string;
  anonymous: boolean;
  recipientPhone: string;
  plan?: string;
}

export interface GiftTokenData {
  v: 1;
  id: string;
  k: GiftKind;
  n: string;
  a: string;
  m: string;
  s: string;
  an: boolean;
  r: string;
  d: number;
  ref: string;
  p?: string;
}

export interface GiftLink {
  token: string;
  url: string;
  data: GiftTokenData;
}

const SHORT_CODE_LENGTH = 8;
const SHORT_CODE_ALPHABET =
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const SHORT_CODE_PATTERN = new RegExp(
  `^[${SHORT_CODE_ALPHABET}]{${SHORT_CODE_LENGTH}}$`,
);

@Injectable()
export class GiftService {
  private readonly logger = new Logger(GiftService.name);
  private readonly baseUrl = (
    process.env.PUBLIC_APP_URL || 'https://wappay-ten.vercel.app'
  ).replace(/\/+$/, '');
  private readonly claimedGiftIds = new Set<string>();
  /** Short code → gift payload. Keeps claim URLs tiny. */
  private readonly giftStore = new Map<string, GiftTokenData>();

  createGiftLink(input: GiftLinkInput): GiftLink {
    const data: GiftTokenData = {
      v: 1,
      id: input.id,
      k: input.kind,
      n: input.name,
      a: input.amountKobo.toString(),
      m: input.message.slice(0, 240),
      s: input.senderName.slice(0, 60),
      an: input.anonymous,
      r: input.recipientPhone,
      d: Date.now(),
      ref: input.reference,
      ...(input.plan ? { p: input.plan } : {}),
    };

    const token = this.generateShortCode();
    this.giftStore.set(token, data);

    return {
      token,
      url: `${this.baseUrl}/gift/${token}`,
      data,
    };
  }

  verifyToken(token: string): GiftTokenData | null {
    if (!token || !SHORT_CODE_PATTERN.test(token)) {
      return null;
    }

    const data = this.giftStore.get(token);
    if (!data) {
      this.logger.warn(`Rejected unknown gift code: ${token}`);
      return null;
    }

    return data;
  }

  claim(giftId: string): void {
    this.claimedGiftIds.add(giftId);
  }

  isClaimed(giftId: string): boolean {
    return this.claimedGiftIds.has(giftId);
  }

  private generateShortCode(): string {
    const bytes = crypto.randomBytes(SHORT_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
      code += SHORT_CODE_ALPHABET[bytes[i] % SHORT_CODE_ALPHABET.length];
    }
    return this.giftStore.has(code) ? this.generateShortCode() : code;
  }
}
