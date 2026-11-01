import { Module } from '@nestjs/common';
import { RecipientsService } from './recipients.service';

@Module({
  providers: [RecipientsService],
  exports: [RecipientsService],
})
export class RecipientsModule {}
