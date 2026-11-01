// Formal Financial Provider Contract for WAPPay Banking Infrastructure

export interface ResolveAccountDto {
  accountNumber: string;
  bankCode: string;
}

export interface AccountResolutionResult {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  isVerified: boolean;
}

export interface InitiateTransferDto {
  internalReference: string;
  idempotencyKey: string;
  amountKobo: bigint;
  currency: string;
  destinationAccountNumber: string;
  destinationBankCode: string;
  destinationAccountName: string;
  narration: string;
}

export interface ProviderTransferResponse {
  providerReference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  message: string;
  feeKobo: bigint;
  settlementDate?: Date;
  rawResponse?: any;
}

export interface ProviderStatusResponse {
  providerReference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  amountKobo: bigint;
  isSettled: boolean;
  message?: string;
}

export interface IFinancialProvider {
  readonly providerName: string;
  readonly isSandbox: boolean;

  resolveAccount(dto: ResolveAccountDto): Promise<AccountResolutionResult>;
  initiateTransfer(dto: InitiateTransferDto): Promise<ProviderTransferResponse>;
  getTransactionStatus(providerReference: string): Promise<ProviderStatusResponse>;
}
