import { Module } from '@nestjs/common';
import { AIService } from './ai.service';

@Module({
  providers: [
    AIService,
    {
      provide: 'AI_PROVIDER',
      useExisting: AIService,
    },
  ],
  exports: ['AI_PROVIDER', AIService],
})
export class AIModule {}
