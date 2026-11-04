/**
 * Brand sign-off for all WAPPay WhatsApp messages.
 * Every outgoing assistant message MUST end with this.
 */
export function withBrand(message: string): string {
  const brand = 'from WappPay';
  if (message.trim().endsWith(brand)) return message;
  return `${message.trim()}\n\n${brand}`;
}

/**
 * Format kobo as Naira string.
 */
export function formatNaira(kobo: bigint | number): string {
  const naira = Number(kobo) / 100;
  return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Wallet balance display.
 */
export function formatBalance(kobo: bigint | number): string {
  return formatNaira(kobo);
}
