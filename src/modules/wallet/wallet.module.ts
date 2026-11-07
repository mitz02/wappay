import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
