import { Injectable, Logger } from '@nestjs/common';
import { createPublicKey, createPrivateKey, privateDecrypt, publicEncrypt, createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

export interface DecryptedFlowRequest {
  version: string;
  action: 'INIT' | 'data_exchange' | 'BACK' | 'ping';
  screen?: string;
  data?: Record<string, any>;
  flow_token?: string;
  flow_token_signature?: string;
}

@Injectable()
export class FlowEncryptionService {
  private readonly logger = new Logger(FlowEncryptionService.name);
  private readonly mockMode: boolean;
  private privateKeyPem: string | null = null;
  private publicKeyPem: string | null = null;

  constructor() {
    this.mockMode = process.env.WHATSAPP_FLOW_ENCRYPTION !== 'true';
    if (!this.mockMode) {
      this.loadKeys();
    } else {
      this.logger.log('Flow encryption running in MOCK mode (no RSA keys configured)');
    }
  }

  private loadKeys(): void {
    const priv = process.env.WHATSAPP_FLOW_PRIVATE_KEY;
    const pub = process.env.WHATSAPP_FLOW_PUBLIC_KEY;
    if (priv && pub) {
      this.privateKeyPem = priv.replace(/\\n/g, '\n');
      this.publicKeyPem = pub.replace(/\\n/g, '\n');
      this.logger.log('Flow RSA keys loaded');
    } else {
      this.logger.warn('WHATSAPP_FLOW_PRIVATE_KEY/PUBLIC_KEY not set — falling back to mock mode');
      (this as any).mockMode = true;
    }
  }

  /**
   * Decrypt an incoming Flow endpoint request.
   * In mock mode, accepts plain JSON body directly.
   */
  decryptRequest(body: any): DecryptedFlowRequest {
    if (this.mockMode) {
      return body as DecryptedFlowRequest;
    }

    const { encrypted_flow_data, encrypted_aes_key, initial_vector } = body;
    if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
      throw new Error('Missing encrypted payload fields');
    }

    const aesKeyBuffer = privateDecrypt(
      {
        key: createPrivateKey(this.privateKeyPem!) as any,
        padding: 'RSA_PKCS1_OAEP_PADDING',
        oaepHash: 'sha256',
      } as any,
      Buffer.from(encrypted_aes_key, 'base64'),
    );

    const iv = Buffer.from(initial_vector, 'base64');
    const decipher = createDecipheriv('aes-128-gcm', aesKeyBuffer, iv);
    const encrypted = Buffer.from(encrypted_flow_data, 'base64');
    const authTag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(0, encrypted.length - 16);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Encrypt a response for the Flow endpoint.
   * In mock mode, returns the plain object (wrapped for testing).
   */
  encryptResponse(payload: Record<string, any>): { body: string; contentType: string } {
    if (this.mockMode) {
      return { body: JSON.stringify(payload), contentType: 'application/json' };
    }

    const aesKey = randomBytes(16);
    const iv = randomBytes(16);

    const cipher = createCipheriv('aes-128-gcm', aesKey, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, authTag]);

    const wrappedKey = publicEncrypt(
      {
        key: createPublicKey(this.publicKeyPem!) as any,
        padding: 'RSA_PKCS1_OAEP_PADDING',
        oaepHash: 'sha256',
      } as any,
      aesKey,
    );

    // Bit-invert IV for response
    const invertedIv = Buffer.from(iv);
    for (let i = 0; i < invertedIv.length; i++) {
      invertedIv[i] = ~invertedIv[i] & 0xff;
    }

    return {
      body: JSON.stringify({
        encrypted_flow_data: combined.toString('base64'),
        encrypted_aes_key: wrappedKey.toString('base64'),
        initial_vector: invertedIv.toString('base64'),
      }),
      contentType: 'text/plain',
    };
  }

  /**
   * Validate flow_token signature (Data API 4.0 + Flow JSON 7.3).
   * In mock mode, always passes.
   */
  validateFlowTokenSignature(flowToken: string, signature?: string): boolean {
    if (this.mockMode) return true;
    if (!signature) return true;

    try {
      const appSecret = process.env.WHATSAPP_APP_SECRET;
      if (!appSecret) return true;

      const expected = createHash('sha256')
        .update(flowToken + appSecret)
        .digest('base64');

      return expected === signature;
    } catch {
      return false;
    }
  }

  isMockMode(): boolean {
    return this.mockMode;
  }
}
