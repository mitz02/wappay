import { Injectable, Logger } from '@nestjs/common';
import {
  IFinancialProvider,
  ResolveAccountDto,
  AccountResolutionResult,
  InitiateTransferDto,
  ProviderTransferResponse,
  ProviderStatusResponse,
} from '../../contracts/financial/financial-provider.contract';

@Injectable()
export class SandboxProviderAdapter implements IFinancialProvider {
  private readonly logger = new Logger(SandboxProviderAdapter.name);
  readonly providerName = 'SANDBOX_PROVIDER';
  readonly isSandbox = true;

  async resolveAccount(dto: ResolveAccountDto): Promise<AccountResolutionResult> {
    this.logger.log(`[SIMULATED] Resolving account ${dto.accountNumber} with bank ${dto.bankCode}`);

    // Realistic Nigerian bank name mock
    const bankNames: Record<string, string> = {
      '058': 'Guaranty Trust Bank',
      '011': 'First Bank of Nigeria',
      '033': 'United Bank for Africa',
      '057': 'Zenith Bank',
      '044': 'Access Bank',
      '035': 'Wema Bank',
      '999': 'Sandbox Test Bank',
    };

    return {
      accountNumber: dto.accountNumber,
      accountName: 'TEST VERIFIED RECIPIENT',
      bankCode: dto.bankCode,
      bankName: bankNames[dto.bankCode] || 'Simulated Commercial Bank',
      isVerified: true,
    };
  }

  async initiateTransfer(dto: InitiateTransferDto): Promise<ProviderTransferResponse> {
    this.logger.log(
      `[SIMULATED] Initiating payout: ₦${Number(dto.amountKobo) / 100} to ${dto.destinationAccountName} (${dto.destinationAccountNumber})`,
    );

    const ref = `SIM_PAYOUT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Deterministic simulation hook for testing edge conditions:
    // Amount ending in 99 Kobo simulates PENDING (network uncertainty)
    if (dto.amountKobo % 100n === 99n) {
      return {
        providerReference: ref,
        status: 'PENDING',
        message: 'Payout accepted by clearing network; awaiting settlement confirmation.',
        feeKobo: 1000n, // 10 NGN
        settlementDate: new Date(),
      };
    }

    // Amount ending in 98 Kobo simulates synchronous FAILED
    if (dto.amountKobo % 100n === 98n) {
      return {
        providerReference: ref,
        status: 'FAILED',
        message: 'Destination bank rejected transfer: Account is dormant or restricted.',
        feeKobo: 0n,
      };
    }

    // Default: Immediate simulated success
    return {
      providerReference: ref,
      status: 'SUCCESS',
      message: 'Transfer completed successfully via simulated NIP rails.',
      feeKobo: 1000n, // 10 NGN
      settlementDate: new Date(),
    };
  }

  async getTransactionStatus(providerReference: string): Promise<ProviderStatusResponse> {
    this.logger.log(`[SIMULATED] Querying transfer status for ref: ${providerReference}`);
    return {
      providerReference,
      status: 'SUCCESS',
      amountKobo: 500000n,
      isSettled: true,
      message: 'Simulated payout verified as credited.',
    };
  }
}
