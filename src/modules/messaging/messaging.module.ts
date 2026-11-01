import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { ConversationRouterService } from './conversation-router.service';
import { CustomersModule } from '../customers/customers.module';
import { AIModule } from '../artificial-intelligence/ai.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [CustomersModule, AIModule, TransactionsModule],
  providers: [MessagingService, ConversationRouterService],
  exports: [MessagingService, ConversationRouterService],
})
export class MessagingModule {}
