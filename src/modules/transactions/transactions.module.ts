import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { LedgerModule } from '../ledger/ledger.module';
import { RecipientsModule } from '../recipients/recipients.module';
import { AuthModule } from '../authentication/auth.module';
import { FinancialProvidersModule } from '../financial-providers/financial-providers.module';

@Module({
  imports: [
    LedgerModule,
    RecipientsModule,
    AuthModule,
    FinancialProvidersModule,
  ],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
