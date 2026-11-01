import { Module } from '@nestjs/common';
import { SandboxProviderAdapter } from './sandbox-provider.adapter';

@Module({
  providers: [
    SandboxProviderAdapter,
    {
      provide: 'FINANCIAL_PROVIDER',
      useExisting: SandboxProviderAdapter,
    },
  ],
  exports: ['FINANCIAL_PROVIDER', SandboxProviderAdapter],
})
export class FinancialProvidersModule {}
