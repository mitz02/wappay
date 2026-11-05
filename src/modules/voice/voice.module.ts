import { Module, forwardRef } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { AIModule } from '../artificial-intelligence/ai.module';

@Module({
  imports: [forwardRef(() => AIModule)],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
