import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    // Support full Redis URL (e.g. Upstash on Vercel) or host/port/password individually
    const redisUrl = process.env.REDIS_URL;
    const host = this.configService.get<string>('redis.host') || 'localhost';
    const port = this.configService.get<number>('redis.port') || 6379;
    const password = this.configService.get<string>('redis.password');

    try {
      this.client = redisUrl
        ? new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
          })
        : new Redis({
            host,
            port,
            password: password || undefined,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // Do not spam reconnect logs if local redis is offline during tests
          });

      // Attach error listener BEFORE connect() to prevent "Unhandled error event"
      // in serverless environments (Vercel) where no Redis is available locally.
      this.client.on('error', (err) => {
        this.logger.warn(`Redis connection error: ${err.message}. Operating in degraded/sync mode.`);
      });

      this.client.connect().then(() => {
        const target = redisUrl ? '(via REDIS_URL)' : `${host}:${port}`;
        this.logger.log(`Connected to Redis ${target}`);
      }).catch((err) => {
        const target = redisUrl ? '(via REDIS_URL)' : `${host}:${port}`;
        this.logger.warn(`Redis server not available at ${target} (${err.message}). Queue workers will operate in degraded/sync mode.`);
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
