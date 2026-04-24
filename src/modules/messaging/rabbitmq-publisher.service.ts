import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RabbitMqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisherService.name);
  private client: ClientProxy | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      this.logger.warn('RabbitMQ publisher disabled (RABBITMQ_URL not set)');
      return;
    }
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue:
          this.config.get<string>('RABBITMQ_PUBLISH_QUEUE') ??
          this.config.get<string>('RABBITMQ_QUEUE') ??
          'wms_events',
        queueOptions: { durable: true },
      },
    });
  }

  async onModuleDestroy() {
    if (this.client) await this.client.close();
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async emit<T>(pattern: string, payload: T): Promise<void> {
    if (!this.client) return;
    await firstValueFrom(this.client.emit(pattern, payload));
  }
}
