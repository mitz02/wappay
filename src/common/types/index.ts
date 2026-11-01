// Core Domain Types & Financial Unit Helpers

export type MinorUnit = bigint; // Represents amounts in Kobo

/**
 * Cleanly format Kobo into human-readable NGN currency string without floating point errors.
 * Example: 500000n -> "₦5,000.00", 12345n -> "₦123.45"
 */
export function formatKoboToNaira(kobo: bigint): string {
  const isNegative = kobo < 0n;
  const absoluteKobo = isNegative ? -kobo : kobo;
  const naira = absoluteKobo / 100n;
  const remainderKobo = absoluteKobo % 100n;

  const formattedNaira = naira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formattedKobo = remainderKobo.toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}₦${formattedNaira}.${formattedKobo}`;
}

/**
 * Safely parse Naira string or integer to Kobo bigint.
 * Example: "5000.50" -> 500050n, "2000" -> 200000n
 */
export function parseNairaToKobo(amount: string | number): bigint {
  const cleanStr = String(amount).replace(/[^0-9.-]/g, '');
  if (!cleanStr || isNaN(Number(cleanStr))) {
    throw new Error(`Invalid monetary amount: ${amount}`);
  }

  const parts = cleanStr.split('.');
  const whole = BigInt(parts[0] || '0');
  const fraction = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const fractionKobo = BigInt(fraction);

  if (cleanStr.startsWith('-')) {
    return whole * 100n - fractionKobo;
  }
  return whole * 100n + fractionKobo;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    correlationId?: string;
  };
}
