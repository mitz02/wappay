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

@Injectable()
export class GiftService {
  private readonly logger = new Logger(GiftService.name);
  private readonly secret =
    process.env.GIFT_LINK_SECRET ||
    process.env.WHATSAPP_APP_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    'wappay-dev-gift-secret';
  private readonly baseUrl = (
    process.env.PUBLIC_APP_URL || 'https://wappay-ten.vercel.app'
  ).replace(/\/+$/, '');
  private readonly claimedGiftIds = new Set<string>();

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

    const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString(
      'base64url',
    );
    const token = `${encoded}.${this.sign(encoded)}`;

    return {
      token,
      url: `${this.baseUrl}/gift/${token}`,
      data,
    };
  }

  verifyToken(token: string): GiftTokenData | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    if (!encoded || !signature) return null;
    if (!this.isValidSignature(encoded, signature)) return null;

    try {
      const payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as GiftTokenData;

      if (payload?.v !== 1) return null;
      if (!['AIRTIME', 'DATA', 'MONEY'].includes(payload.k)) return null;
      if (
        typeof payload.id !== 'string' ||
        typeof payload.n !== 'string' ||
        typeof payload.a !== 'string' ||
        typeof payload.m !== 'string' ||
        typeof payload.s !== 'string' ||
        typeof payload.r !== 'string' ||
        typeof payload.ref !== 'string'
      ) {
        return null;
      }

      BigInt(payload.a);
      return payload;
    } catch (err: any) {
      this.logger.warn(`Rejected malformed gift token: ${err.message}`);
      return null;
    }
  }

  claim(giftId: string): void {
    this.claimedGiftIds.add(giftId);
  }

  isClaimed(giftId: string): boolean {
    return this.claimedGiftIds.has(giftId);
  }

  private sign(value: string): string {
    return crypto.createHmac('sha256', this.secret).update(value).digest('base64url');
  }

  private isValidSignature(value: string, signature: string): boolean {
    const expected = this.sign(value);
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
