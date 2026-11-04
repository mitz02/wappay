import { Module } from '@nestjs/common';
import { GiftService } from './gift.service';
import { GiftClaimController } from './gift-claim.controller';

@Module({
  controllers: [GiftClaimController],
  providers: [GiftService],
  exports: [GiftService],
})
export class GiftingModule {}
