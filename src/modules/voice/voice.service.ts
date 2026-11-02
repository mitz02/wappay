import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AIService } from '../artificial-intelligence/ai.service';
export interface VoiceMessagePayload {
  mediaId: string;
  senderPhone: string;
  senderName?: string;
  mimeType: string;
  fileSizeBytes: number;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly MAX_AUDIO_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB limit

  constructor(private readonly aiService: AIService) {}

  /**
   * Complete voice processing pipeline for inbound WhatsApp voice notes.
   */
  async processVoiceNote(payload: VoiceMessagePayload): Promise<string> {
    this.logger.log(`Processing voice note from ${payload.senderPhone} (Media ID: ${payload.mediaId})`);

    // 1. Validate Media constraints
    if (payload.fileSizeBytes > this.MAX_AUDIO_SIZE_BYTES) {
      throw new BadRequestException('Voice note exceeds the maximum permitted size of 16MB.');
    }

    const supportedMimes = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/amr', 'audio/wav'];
    const isSupported = supportedMimes.some((m) => payload.mimeType.includes(m));
    if (!isSupported) {
      throw new BadRequestException(`Unsupported audio format: ${payload.mimeType}`);
    }

    // 2. Fetch Media Buffer (in sandbox, uses simulated audio stream)
    const audioBuffer = Buffer.from('simulated_audio_data');

    // 3. Transcribe audio to text
    const transcription = await this.aiService.transcribeAudio(audioBuffer);
    this.logger.log(`Audio transcribed successfully: "${transcription}"`);

    // 4. Return a sandbox response while the conversation router is disabled.
    return `Voice note received from ${payload.senderName || payload.senderPhone}. Transcription: ${transcription}`;
  }
}
