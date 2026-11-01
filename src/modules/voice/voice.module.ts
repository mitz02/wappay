import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { AIModule } from '../artificial-intelligence/ai.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [AIModule, MessagingModule],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
