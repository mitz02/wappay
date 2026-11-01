import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('redis.host') || 'localhost';
    const port = this.configService.get<number>('redis.port') || 6379;
    const password = this.configService.get<string>('redis.password');

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Do not spam reconnect logs if local redis is offline during tests
      });

      this.client.connect().then(() => {
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      }).catch((err) => {
        this.logger.warn(`Redis server not available at ${host}:${port} (${err.message}). Queue workers will operate in degraded/sync mode.`);
      });
    } catch (err: any) {
      this.logger.warn(`Redis init error: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Acquire a distributed lock for a transaction or webhook event.
   */
  async acquireLock(key: string, ttlSeconds = 10): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') {
      return true; // Graceful fallback in offline/dev test environments
    }
    const result = await this.client.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    if (this.client && this.client.status === 'ready') {
      await this.client.del(`lock:${key}`);
    }
  }
}
