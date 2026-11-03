import { VoiceService } from './voice.service';
import { GroqService } from '../artificial-intelligence/services/groq.service';
import { AIAssistantService } from '../artificial-intelligence/services/ai-assistant.service';
import { BadRequestException } from '@nestjs/common';

describe('VoiceService', () => {
  let service: VoiceService;
  let mockGroqService: jest.Mocked<GroqService>;
  let mockAiAssistantService: jest.Mocked<AIAssistantService>;

  beforeEach(() => {
    mockGroqService = {
      transcribeAudio: jest.fn().mockResolvedValue('Send 5000 naira to Mum'),
    } as unknown as jest.Mocked<GroqService>;

    mockAiAssistantService = {
      processCustomerMessage: jest.fn().mockResolvedValue(
        '📋 *Simulated Transfer Confirmation*\n\n' +
          '• *Recipient:* *Jane Adeleke*\n' +
          '• *Amount:* *₦5,000.00*\n\n' +
          '_Reply *YES* to confirm this transfer._',
      ),
    } as unknown as jest.Mocked<AIAssistantService>;

    service = new VoiceService(mockGroqService, mockAiAssistantService);
  });

  // ---------------------------------------------------------------------------
  // 1. Constraints & Format Validation
  // ---------------------------------------------------------------------------

  it('rejects audio notes larger than 16MB limit', async () => {
    const oversizedBuffer = Buffer.alloc(17 * 1024 * 1024); // 17MB

    await expect(
      service.processVoiceNote({
        audioBuffer: oversizedBuffer,
        senderPhone: '2348012345678',
        mimeType: 'audio/ogg',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported audio formats (e.g. video, pdf, text)', async () => {
    await expect(
      service.processVoiceNote({
        audioBuffer: Buffer.from('dummy_bytes'),
        senderPhone: '2348012345678',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts valid supported audio formats (OGG, MP3, WAV, AMR, MP4)', async () => {
    const validMimes = ['audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/amr', 'audio/mp4'];

    for (const mime of validMimes) {
      const result = await service.processVoiceNote({
        audioBuffer: Buffer.from('valid_audio_bytes'),
        senderPhone: '2348012345678',
        mimeType: mime,
      });

      expect(result).toContain('🎙️ *Voice Note:*');
      expect(result).toContain('Send 5000 naira to Mum');
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Transcription & Conversational Pipeline Integration
  // ---------------------------------------------------------------------------

  it('transcribes voice audio and forwards transcript to AIAssistantService', async () => {
    const payload = {
      mediaId: 'media_123',
      audioBuffer: Buffer.from('valid_audio_bytes'),
      senderPhone: '2348012345678',
      senderName: 'Adebayo',
      mimeType: 'audio/ogg; codecs=opus',
    };

    const reply = await service.processVoiceNote(payload);

    expect(mockGroqService.transcribeAudio).toHaveBeenCalledWith(
      payload.audioBuffer,
      'voicenote.ogg',
    );
    expect(mockAiAssistantService.processCustomerMessage).toHaveBeenCalledWith(
      '2348012345678',
      'Send 5000 naira to Mum',
      'Adebayo',
    );
    // Verifies the user is shown the exact transcribed text for confirmation
    expect(reply).toContain('🎙️ *Voice Note:* _"Send 5000 naira to Mum"_');
    expect(reply).toContain('Simulated Transfer Confirmation');
  });

  // ---------------------------------------------------------------------------
  // 3. Financial Safety Invariant (Voice Note Does NOT Bypass Confirmation)
  // ---------------------------------------------------------------------------

  it('ensures voice notes require explicit confirmation and do NOT auto-execute', async () => {
    const reply = await service.processVoiceNote({
      audioBuffer: Buffer.from('valid_audio_bytes'),
      senderPhone: '2348012345678',
      mimeType: 'audio/ogg',
    });

    // The reply must ask the user to confirm via YES/PIN, never claim instant transfer execution
    expect(reply).toContain('Reply *YES* to confirm');
  });

  // ---------------------------------------------------------------------------
  // 4. Edge Cases: Inaudible / Empty Audio & Groq Failures
  // ---------------------------------------------------------------------------

  it('returns guidance when voice note contains no clear speech', async () => {
    mockGroqService.transcribeAudio.mockResolvedValueOnce('');

    const reply = await service.processVoiceNote({
      audioBuffer: Buffer.from('silent_audio_bytes'),
      senderPhone: '2348012345678',
      mimeType: 'audio/ogg',
    });

    expect(reply).toContain('could not detect any clear speech');
    expect(mockAiAssistantService.processCustomerMessage).not.toHaveBeenCalled();
  });

  it('handles Groq Whisper API error gracefully without crashing', async () => {
    mockGroqService.transcribeAudio.mockRejectedValueOnce(new Error('Whisper API connection error'));

    const reply = await service.processVoiceNote({
      audioBuffer: Buffer.from('corrupted_audio_bytes'),
      senderPhone: '2348012345678',
      mimeType: 'audio/ogg',
    });

    expect(reply).toContain('could not transcribe your audio message');
  });
});
