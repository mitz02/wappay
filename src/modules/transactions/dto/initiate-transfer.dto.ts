export interface CreateTransferRequestDto {
  customerId: string;
  recipientAliasOrName: string;
  amountKobo: bigint;
  narration?: string;
  idempotencyKey: string;
}

export interface AuthorizeTransferDto {
  transactionId: string;
  customerId: string;
  pin: string;
  challengeToken: string;
}

export interface TransactionPreviewDto {
  transactionId: string;
  amountKobo: bigint;
  feeKobo: bigint;
  totalKobo: bigint;
  currency: string;
  recipientName: string;
  recipientAccountNumber: string;
  recipientBankName: string;
  challengeToken: string;
  expiresInMinutes: number;
}
