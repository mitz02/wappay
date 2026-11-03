import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendWhatsAppTextMessageDto {
  @IsString()
  @IsNotEmpty()
  to!: string; // Recipient phone number (E.164 formatted without '+')

  @IsString()
  @IsNotEmpty()
  text!: string; // Message content

  @IsString()
  @IsOptional()
  replyToMessageId?: string; // Optional context message ID for replying
}
