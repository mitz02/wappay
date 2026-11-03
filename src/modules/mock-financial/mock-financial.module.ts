import { Module } from '@nestjs/common';
import { MockFinancialService } from './services/mock-financial.service';
import { LedgerModule } from '../ledger/ledger.module';
import { RecipientsModule } from '../recipients/recipients.module';

@Module({
  imports: [LedgerModule, RecipientsModule],
  providers: [MockFinancialService],
  exports: [MockFinancialService],
})
export class MockFinancialModule {}
