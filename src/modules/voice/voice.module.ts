import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { AIModule } from '../artificial-intelligence/ai.module';

@Module({
  imports: [AIModule],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
