import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WhatsAppApiResponse,
  WhatsAppOutgoingMessagePayload,
} from '../interfaces/whatsapp-message.interface';
import { WHATSAPP_CONFIG } from '../whatsapp.constants';

@Injectable()
export class WhatsAppApiService {
  private readonly logger = new Logger(WhatsAppApiService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Cleans credential values copied from dashboards or .env files.
   * Strips wrapping quotes, an accidental "Bearer " prefix, and whitespace/newlines.
   */
  private sanitizeSecret(raw: string | undefined): string {
    let value = (raw ?? '').trim();

    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if (
        (first === '"' && last === '"') ||
        (first === "'" && last === "'")
      ) {
        value = value.slice(1, -1).trim();
      }
    }

    value = value.replace(/^Bearer\s+/i, '').trim();
    return value.replace(/\s+/g, '');
  }

  private normalizeApiUrl(raw: string | undefined): string {
    return (raw || WHATSAPP_CONFIG.DEFAULT_GRAPH_API_BASE).trim().replace(/\/+$/, '');
  }

  /** Safe, non-revealing diagnostics used when Meta rejects a token. */
  private describeCredential(raw: string | undefined): string {
    const value = (raw ?? '').trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    const bearerPrefix = /^Bearer\s+/i.test(value);
    const containsWhitespace = /\s/.test(value);
    return `length=${value.length}, quoted=${quoted}, bearerPrefix=${bearerPrefix}, whitespace=${containsWhitespace}`;
  }

  private simulatedDelivery(cleanTo: string): WhatsAppApiResponse {
    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: cleanTo, wa_id: cleanTo }],
      messages: [{ id: `wamid.SIMULATED_${Date.now()}` }],
    };
  }

  /**
   * Dispatches an outgoing text message or reply to the Meta WhatsApp Cloud API.
   *
   * @param to - Recipient phone number (normalized, e.g. "2348012345678").
   * @param text - Plaintext message content.
   * @param replyToMessageId - Optional WhatsApp message ID if this is an in-thread reply.
   */
  /**
   * Dispatches an interactive button message to the Meta WhatsApp Cloud API.
   * Maximum 3 buttons per Meta WhatsApp specification.
   */
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText = 'WAPPay Instant Banking',
    replyToMessageId?: string,
  ): Promise<WhatsAppApiResponse> {
    const cleanTo = to.replace(/[^0-9]/g, '');
    const actionButtons = buttons.slice(0, 3).map((b) => ({
      type: 'reply',
      reply: {
        id: b.id,
        title: b.title.slice(0, 20),
      },
    }));

    const payload: any = {
      messaging_product: WHATSAPP_CONFIG.MESSAGING_PRODUCT,
      recipient_type: WHATSAPP_CONFIG.RECIPIENT_TYPE_INDIVIDUAL,
      to: cleanTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        footer: { text: footerText },
        action: { buttons: actionButtons },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: 'text', text: headerText };
    }
    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    return await this.dispatchPayload(cleanTo, payload);
  }

  /**
   * Dispatches an interactive list message to the Meta WhatsApp Cloud API.
   * Supports up to 10 rows across sections.
   */
  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText = 'WAPPay Instant Banking',
    replyToMessageId?: string,
  ): Promise<WhatsAppApiResponse> {
    const cleanTo = to.replace(/[^0-9]/g, '');

    const payload: any = {
      messaging_product: WHATSAPP_CONFIG.MESSAGING_PRODUCT,
      recipient_type: WHATSAPP_CONFIG.RECIPIENT_TYPE_INDIVIDUAL,
      to: cleanTo,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        footer: { text: footerText },
        action: {
          button: buttonText.slice(0, 20),
          sections: sections.map((s) => ({
            title: s.title.slice(0, 24),
            rows: s.rows.map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
              description: r.description ? r.description.slice(0, 72) : undefined,
            })),
          })),
        },
      },
    };

    if (headerText) {
      payload.interactive.header = { type: 'text', text: headerText };
    }
    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    return await this.dispatchPayload(cleanTo, payload);
  }

  /**
   * Internal helper to dispatch any prepared payload to Meta Cloud API.
   */
  private async dispatchPayload(cleanTo: string, payload: any): Promise<WhatsAppApiResponse> {
    const rawAccessToken = this.configService.get<string>('whatsapp.accessToken');
    const accessToken = this.sanitizeSecret(rawAccessToken);
    const phoneNumberId = this.sanitizeSecret(this.configService.get<string>('whatsapp.phoneNumberId'));
    const apiUrl = this.normalizeApiUrl(this.configService.get<string>('whatsapp.apiUrl'));
    const timeoutMs = this.configService.get<number>('whatsapp.apiTimeoutMs') || WHATSAPP_CONFIG.DEFAULT_TIMEOUT_MS;
    const isSimulated = this.configService.get<boolean>('isSimulated');

    if (!accessToken || !phoneNumberId) {
      throw new InternalServerErrorException('WhatsApp API configuration is incomplete.');
    }

    const maskedTo = cleanTo.length > 6 ? (cleanTo.slice(0, 3) + '***' + cleanTo.slice(-3)) : '***';
    const url = apiUrl + '/' + phoneNumberId + '/messages';

    if (isSimulated && accessToken.startsWith('mock_')) {
      this.logger.log('[SIMULATED] Simulated interactive message delivered to ' + maskedTo);
      return this.simulatedDelivery(cleanTo);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseBody: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorDetails = responseBody?.error?.message || response.statusText;
        const errorCode = responseBody?.error?.code;
        this.logger.warn(
          `Meta API interactive dispatch error (HTTP ${response.status}, Code: ${errorCode}): ${errorDetails}`,
        );

        if (response.status === 401) {
          this.logger.error(
            `WhatsApp credential diagnostics: ${this.describeCredential(rawAccessToken)}. ` +
              'Temporary Meta tokens expire after ~24 hours; use a permanent System User token for production.',
          );

          if (isSimulated) {
            this.logger.warn(
              '[SIMULATED] Meta rejected the access token; returning a simulated delivery receipt because IS_SIMULATED=true.',
            );
            return this.simulatedDelivery(cleanTo);
          }

          throw new UnauthorizedException(
            'WhatsApp Cloud API authentication failed. Verify WHATSAPP_ACCESS_TOKEN is a valid, unexpired System User token.',
          );
        }

        throw new BadRequestException('Meta WhatsApp API error: ' + errorDetails);
      }

      return responseBody as WhatsAppApiResponse;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async sendTextMessage(
    to: string,
    text: string,
    replyToMessageId?: string,
  ): Promise<WhatsAppApiResponse> {
    const rawAccessToken = this.configService.get<string>('whatsapp.accessToken');
    const accessToken = this.sanitizeSecret(rawAccessToken);
    const phoneNumberId = this.sanitizeSecret(this.configService.get<string>('whatsapp.phoneNumberId'));
    const apiUrl = this.normalizeApiUrl(this.configService.get<string>('whatsapp.apiUrl'));
    const timeoutMs = this.configService.get<number>('whatsapp.apiTimeoutMs') || WHATSAPP_CONFIG.DEFAULT_TIMEOUT_MS;
    const isSimulated = this.configService.get<boolean>('isSimulated');

    if (!accessToken || !phoneNumberId) {
      this.logger.error('Missing WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)');
      throw new InternalServerErrorException('WhatsApp API configuration is incomplete.');
    }

    // Clean recipient phone number (digits only)
    const cleanTo = to.replace(/[^0-9]/g, '');
    if (!cleanTo || cleanTo.length < 7) {
      throw new BadRequestException(`Invalid destination phone number: ${to}`);
    }

    const payload: WhatsAppOutgoingMessagePayload = {
      messaging_product: WHATSAPP_CONFIG.MESSAGING_PRODUCT,
      recipient_type: WHATSAPP_CONFIG.RECIPIENT_TYPE_INDIVIDUAL,
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };

    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    const url = `${apiUrl}/${phoneNumberId}/messages`;

    // Safe diagnostic log (Redacting token and masking recipient)
    const maskedTo = cleanTo.length > 6 ? `${cleanTo.slice(0, 3)}***${cleanTo.slice(-3)}` : '***';
    this.logger.log(`Dispatching WhatsApp message to ${maskedTo} via endpoint: ${url}`);

    // If sandbox mode with mock credentials, simulate successful delivery receipt
    if (isSimulated && accessToken.startsWith('mock_')) {
      this.logger.log(`[SIMULATED] Simulated WhatsApp message successfully delivered to ${maskedTo}`);
      return this.simulatedDelivery(cleanTo);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorDetails = responseBody?.error?.message || response.statusText;
        const errorCode = responseBody?.error?.code;

        this.logger.error(
          `Meta WhatsApp API returned HTTP ${response.status} (Code: ${errorCode}): ${errorDetails}`,
        );

        if (response.status === 401) {
          this.logger.error(
            `WhatsApp credential diagnostics: ${this.describeCredential(rawAccessToken)}. ` +
              'Temporary Meta tokens expire after ~24 hours; use a permanent System User token for production.',
          );

          if (isSimulated) {
            this.logger.warn(
              `[SIMULATED] Meta rejected the access token; returning a simulated delivery receipt to ${maskedTo} because IS_SIMULATED=true.`,
            );
            return this.simulatedDelivery(cleanTo);
          }

          throw new UnauthorizedException(
            'WhatsApp Cloud API authentication failed. Verify WHATSAPP_ACCESS_TOKEN is a valid, unexpired System User token.',
          );
        }

        if (response.status === 400) {
          throw new BadRequestException(`WhatsApp API bad request: ${errorDetails}`);
        }

        throw new InternalServerErrorException(`WhatsApp API communication failure: ${errorDetails}`);
      }

      this.logger.log(`WhatsApp message accepted by Meta. Message ID: ${responseBody?.messages?.[0]?.id}`);
      return responseBody as WhatsAppApiResponse;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        this.logger.error(`WhatsApp API call timed out after ${timeoutMs}ms to ${url}`);
        throw new RequestTimeoutException('WhatsApp API request timed out.');
      }

      // Preserve existing HTTP exceptions
      if (
        err instanceof UnauthorizedException ||
        err instanceof BadRequestException ||
        err instanceof InternalServerErrorException ||
        err instanceof RequestTimeoutException
      ) {
        throw err;
      }

      this.logger.error(`Network or fetch failure calling WhatsApp API: ${err.message}`);
      throw new InternalServerErrorException(`Network error communicating with WhatsApp Cloud API: ${err.message}`);
    }
  }

  /**
   * Retrieves media from Meta WhatsApp Cloud API by media ID.
   * Fetches metadata from GET /{media-id}, then downloads the binary content.
   *
   * @param mediaId - The Meta media ID string.
   * @returns Buffer containing media bytes, MIME type, and file size.
   */
  async downloadMedia(
    mediaId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileSizeBytes: number }> {
    const rawAccessToken = this.configService.get<string>('whatsapp.accessToken');
    const accessToken = this.sanitizeSecret(rawAccessToken);
    const apiUrl = this.normalizeApiUrl(this.configService.get<string>('whatsapp.apiUrl'));
    const isSimulated = this.configService.get<boolean>('isSimulated');

    // In simulation / sandbox mode:
    if (
      isSimulated &&
      (!accessToken || accessToken.startsWith('mock_') || mediaId.startsWith('mock_') || mediaId.startsWith('sim_'))
    ) {
      this.logger.log(`[SIMULATED] Retrieved simulated media buffer for media ID: ${mediaId}`);
      return {
        buffer: Buffer.from('simulated_audio_data_voice_note'),
        mimeType: 'audio/ogg; codecs=opus',
        fileSizeBytes: 32,
      };
    }

    if (!accessToken) {
      this.logger.error('Missing WHATSAPP_ACCESS_TOKEN for media retrieval.');
      throw new InternalServerErrorException('WhatsApp access token is not configured.');
    }

    // Step 1: Query Meta Graph API for media URL
    const metaUrl = `${apiUrl}/${mediaId}`;
    const metaResponse = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!metaResponse.ok) {
      const errText = await metaResponse.text().catch(() => '');
      this.logger.error(
        `Failed to retrieve media metadata for ID ${mediaId}: HTTP ${metaResponse.status} - ${errText}`,
      );

      if (metaResponse.status === 401 && isSimulated) {
        this.logger.warn(
          `[SIMULATED] Meta rejected the access token; returning simulated media for ID ${mediaId} because IS_SIMULATED=true.`,
        );
        return {
          buffer: Buffer.from('simulated_audio_data_voice_note'),
          mimeType: 'audio/ogg; codecs=opus',
          fileSizeBytes: 32,
        };
      }

      throw new BadRequestException(
        `Could not retrieve media metadata from WhatsApp (HTTP ${metaResponse.status}).`,
      );
    }

    const metaData: any = await metaResponse.json();
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || 'audio/ogg';
    const fileSizeBytes = metaData.file_size || 0;

    if (!downloadUrl) {
      throw new BadRequestException('WhatsApp media URL was missing from Meta response.');
    }

    // Step 2: Download binary content from media URL
    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'WAPPay-WhatsApp/1.0',
      },
    });

    if (!downloadResponse.ok) {
      throw new BadRequestException(
        `Failed to download WhatsApp media stream (HTTP ${downloadResponse.status}).`,
      );
    }

    const arrayBuffer = await downloadResponse.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType,
      fileSizeBytes: fileSizeBytes || arrayBuffer.byteLength,
    };
  }
}
