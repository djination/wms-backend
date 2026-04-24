import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    const host = this.config.get<string>('REDIS_HOST');
    const maxRetriesPerRequest = 2;
    const lazyConnect = true;

    if (url) {
      this.client = new Redis(url, { maxRetriesPerRequest, lazyConnect });
    } else if (host) {
      const port = Number(this.config.get('REDIS_PORT') ?? 6379);
      const password = this.config.get<string>('REDIS_PASSWORD');
      const db = Number(this.config.get('REDIS_DB') ?? 0);
      this.client = new Redis({
        host,
        port,
        db,
        ...(password ? { password } : {}),
        maxRetriesPerRequest,
        lazyConnect,
      });
    }

    if (this.client) {
      this.client.on('error', (err) => this.logger.warn(`Redis: ${err.message}`));
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (this.client.status === 'wait') await this.client.connect();
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
