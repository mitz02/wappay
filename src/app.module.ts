import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/validation';
import { RedisModule } from './infrastructure/redis/redis.module';
import { FinancialProvidersModule } from './modules/financial-providers/financial-providers.module';
import { AIModule } from './modules/artificial-intelligence/ai.module';
import { VoiceModule } from './modules/voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    RedisModule,
    FinancialProvidersModule,
    AIModule,
    VoiceModule,
  ],
})
export class AppModule {}
