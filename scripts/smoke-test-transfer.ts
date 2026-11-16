/**
 * Smoke test: 4-step send-money flow
 * Run with:  npx ts-node scripts/smoke-test-transfer.ts
 */

import { Test } from '@nestjs/testing';
import { AIAssistantService } from '../src/modules/artificial-intelligence/services/ai-assistant.service';
import { MockFinancialService } from '../src/modules/mock-financial/mock-financial.service';
import { MockDatabaseStore } from '../src/modules/mock-financial/mock-database.store';
import { ConversationHistoryService } from '../src/modules/artificial-intelligence/services/conversation-history.service';
import { IntentParserService } from '../src/modules/artificial-intelligence/services/intent-parser.service';
import { AIService } from '../src/modules/artificial-intelligence/ai.service';

const PHONE = '2348012345678';

async function main() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AIAssistantService,
      MockFinancialService,
      MockDatabaseStore,
      ConversationHistoryService,
      IntentParserService,
      AIService,
    ],
  }).compile();

  const assistant = moduleRef.get(AIAssistantService);

  const steps = [
    'Send ₦5,000 to Mum',  // Step 1 → preview + confirm button
    'YES',                  // Step 2 → PIN prompt
    '1234',                 // Step 3 → success / failure
  ];

  console.log('=== 4-Step Send Money Flow ===\n');
  for (const [i, msg] of steps.entries()) {
    console.log(`\n📲 User [Step ${i + 1}]: ${msg}`);
    const reply = await assistant.processCustomerMessage(PHONE, msg);
    console.log(`🤖 Bot:\n${reply}`);
    console.log('─'.repeat(60));
  }
}

main().catch(console.error);
