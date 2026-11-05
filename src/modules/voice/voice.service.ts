import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { GroqService } from '../artificial-intelligence/services/groq.service';
import { AIAssistantService } from '../artificial-intelligence/services/ai-assistant.service';
export interface VoiceMessagePayload {
  mediaId?: string;
  audioBuffer?: Buffer;
  senderPhone: string;
  senderName?: string;
  mimeType: string;
  fileSizeBytes?: number;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  readonly MAX_AUDIO_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB limit (WhatsApp and Whisper limit)
  readonly SUPPORTED_MIME_TYPES = [
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/amr',
    'audio/wav',
    'audio/webm',
    'audio/x-m4a',
  ];

  constructor(
    private readonly groqService: GroqService,
    @Inject(forwardRef(() => AIAssistantService))
    private readonly aiAssistantService: AIAssistantService,
  ) {}

  /**
   * Complete voice processing pipeline for inbound WhatsApp voice notes.
   *
   * 1. Validates media format and size constraints.
   * 2. Transcribes voice audio using Groq Whisper Large v3 (with sandbox fallback).
   * 3. Forwards transcript to AIAssistantService for verified banking operations.
   * 4. Prepends transcription acknowledgment so the customer sees what was understood.
   *
   * @param payload - Voice message parameters including audio buffer and sender metadata.
   * @returns Customer-facing formatted reply message.
   */
  async processVoiceNote(payload: VoiceMessagePayload): Promise<string> {
    this.logger.log(
      `Processing voice note from ${payload.senderPhone} (Media ID: ${payload.mediaId || 'buffer'})`,
    );

    // 1. Validate Media constraints
    const fileSize = payload.audioBuffer?.length ?? payload.fileSizeBytes ?? 0;
    if (fileSize > this.MAX_AUDIO_SIZE_BYTES) {
      throw new BadRequestException('Voice note exceeds the maximum permitted size of 16MB.');
    }

    const mime = (payload.mimeType || 'audio/ogg').toLowerCase();
    const isSupported = this.SUPPORTED_MIME_TYPES.some((m) => mime.includes(m)) || mime.startsWith('audio/');
    if (!isSupported) {
      throw new BadRequestException(
        `Unsupported audio format: "${payload.mimeType}". Supported formats include OGG, MP3, WAV, AMR, and MP4.`,
      );
    }

    // 2. Obtain Audio Buffer
    const audioBuffer = payload.audioBuffer || Buffer.from('simulated_audio_data_wappay');

    // 3. Transcribe speech-to-text via Groq Whisper API
    let transcription = '';
    try {
      transcription = await this.groqService.transcribeAudio(audioBuffer, 'voicenote.ogg');
    } catch (err: unknown) {
      const error = err as { message?: string };
      this.logger.error(`Voice transcription failure: ${error.message}`);
      return (
        `🎙️ *Voice Note Received*\n\n` +
        `⚠️ Sorry, I could not transcribe your audio message. Please try sending your request as a text message.`
      );
    }

    const trimmedTranscription = transcription?.trim() || '';
    if (!trimmedTranscription) {
      return (
        `🎙️ *Voice Note Received*\n\n` +
        `I could not detect any clear speech in that voice note. Could you please record it again in a quieter environment or send it as a text message?`
      );
    }

    this.logger.log(`Audio transcribed successfully: "${trimmedTranscription}"`);

    // 4. Pass transcript into standard conversational banking assistant
    // Voice notes follow the EXACT same security, preview, confirmation, and limits as text!
    const bankingReply = await this.aiAssistantService.processCustomerMessage(
      payload.senderPhone,
      trimmedTranscription,
      payload.senderName,
    );

    // 5. Prepend transcription acknowledgment so the customer can verify what was heard
    return `🎙️ *Voice Note:* _"${trimmedTranscription}"_\n\n${bankingReply}`;
  }
}
