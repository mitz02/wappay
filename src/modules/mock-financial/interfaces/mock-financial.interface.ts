// Interfaces and Types for Mock Financial Operations

export interface MockAccountBalance {
  customerId: string;
  customerName: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  availableBalanceKobo: bigint;
  isSimulated: true;
}

export interface MockTransactionSummary {
  id: string;
  reference: string;
  type: string;
  state: string;
  amountKobo: bigint;
  feeKobo: bigint;
  currency: string;
  recipientName?: string;
  destinationAccount?: string;
  narration?: string;
  createdAt: Date;
  isSimulated: boolean;
}

export interface MockTransferPreview {
  transactionId: string;
  internalReference: string;
  amountKobo: bigint;
  feeKobo: bigint;
  totalDebitKobo: bigint;
  currency: string;
  recipientName: string;
  recipientAccountNumber: string;
  recipientBankName: string;
  challengeToken: string;
  expiresInMinutes: number;
  isSimulated: true;
}

export interface MockTransferExecutionResult {
  transactionId: string;
  internalReference: string;
  amountKobo: bigint;
  feeKobo: bigint;
  totalDebitedKobo: bigint;
  recipientName: string;
  recipientAccountNumber: string;
  recipientBankName: string;
  newBalanceKobo: bigint;
  status: 'SUCCESSFUL' | 'FAILED';
  settlementMessage: string;
  batchItems?: Array<{ recipientName: string; amountKobo: bigint; reference: string }>;
  isSimulated: true;
}

export interface MockDepositResult {
  transactionId: string;
  reference: string;
  amountCreditedKobo: bigint;
  newBalanceKobo: bigint;
  status: 'SUCCESSFUL';
  isSimulated: true;
}

export interface MockWithdrawalResult {
  transactionId: string;
  reference: string;
  amountDebitedKobo: bigint;
  newBalanceKobo: bigint;
  status: 'SUCCESSFUL';
  isSimulated: true;
}

export interface MockVasResult {
  transactionId: string;
  reference: string;
  type: 'AIRTIME' | 'DATA';
  network: string;
  beneficiaryPhone: string;
  packageDetails: string;
  amountDebitedKobo: bigint;
  newBalanceKobo: bigint;
  status: 'SUCCESSFUL';
  isSimulated: true;
}

export interface MockGiftResult {
  transactionId: string;
  reference: string;
  giftType: 'AIRTIME' | 'DATA' | 'CASH';
  recipientPhone: string;
  amountDebitedKobo: bigint;
  newBalanceKobo: bigint;
  network?: string;
  plan?: string;
  note?: string;
  status: 'SUCCESSFUL';
  isSimulated: true;
}

export interface MockRecipientSummary {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  aliases: string[];
}
