// Interfaces and Types for Mock Financial Operations

import type { MockPaymentDestinationType } from '../mock-financial.constants';

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
  /** Underlying transaction type (TRANSFER / PAYMENT / ...) */
  transactionType?: string;
  batchItems?: Array<{ recipientName: string; amountKobo: bigint; reference: string }>;
  isSimulated: true;
}

export interface MockCrossBorderPreview extends MockTransferPreview {
  destinationType: MockPaymentDestinationType;
  country?: string;
  flag?: string;
  /** Foreign currency code the recipient receives (XAF, GHS, CNY, ...) */
  foreignCurrency?: string;
  /** Formatted foreign amount, e.g. "38,500 XAF" */
  foreignAmountText?: string;
  /** Simulated FX rate text, e.g. "₦1 ≈ 0.385 XAF" */
  rateText?: string;
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
