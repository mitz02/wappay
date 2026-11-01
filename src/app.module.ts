import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/validation';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AuthModule } from './modules/authentication/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { RecipientsModule } from './modules/recipients/recipients.module';
import { FinancialProvidersModule } from './modules/financial-providers/financial-providers.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AIModule } from './modules/artificial-intelligence/ai.module';
import { VoiceModule } from './modules/voice/voice.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { AdminModule } from './modules/administrators/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    PrismaModule,
    RedisModule,
    LedgerModule,
    AuthModule,
    CustomersModule,
    RecipientsModule,
    FinancialProvidersModule,
    TransactionsModule,
    AIModule,
    VoiceModule,
    MessagingModule,
    WebhooksModule,
    ReconciliationModule,
    AdminModule,
  ],
})
export class AppModule {}
