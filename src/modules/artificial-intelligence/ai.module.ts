import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIService } from './ai.service';
import { GroqService } from './services/groq.service';
import { ConversationHistoryService } from './services/conversation-history.service';
import { AIAssistantService } from './services/ai-assistant.service';
import { IntentParserService } from './services/intent-parser.service';
import { MockFinancialModule } from '../mock-financial/mock-financial.module';
import { GiftingModule } from '../gifting/gifting.module';
import { WhatsAppFlowsModule } from '../whatsapp-flows/whatsapp-flows.module';
import { WalletModule } from '../wallet/wallet.module';

/**
 * AIModule
 *
 * Dedicated artificial intelligence module for WAPPay.
 * Encapsulates:
 * - Groq Cloud API LLM integration via official groq-sdk
 * - Conversational context & history management (persisted via Prisma)
 * - Safe conversational AI orchestration connecting Groq intent extraction to the Mock Financial System
 * - Extensible provider abstraction (swappable CHAT_PROVIDER contract)
 * - Deterministic intent & entity extractor (IntentParserService and AIService)
 */
@Module({
  imports: [ConfigModule, MockFinancialModule, GiftingModule, WhatsAppFlowsModule, WalletModule],
  providers: [
    AIService,
    GroqService,
    ConversationHistoryService,
    IntentParserService,
    AIAssistantService,
    {
      provide: 'AI_PROVIDER',
      useExisting: AIService,
    },
    {
      provide: 'CHAT_PROVIDER',
      useExisting: GroqService,
    },
  ],
  exports: [
    AIService,
    GroqService,
    ConversationHistoryService,
    IntentParserService,
    AIAssistantService,
    'AI_PROVIDER',
    'CHAT_PROVIDER',
  ],
})
export class AIModule {}
