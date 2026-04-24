import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqPublisherService } from '../messaging/rabbitmq-publisher.service';
import { RedisService } from '../redis/redis.service';
import { S3ObjectStorageService } from '../storage/s3-object-storage.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rmq: RabbitMqPublisherService,
    private readonly s3: S3ObjectStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness' })
  live() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness (DB, optional Redis / RMQ, uploads local or S3)' })
  async ready() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return {
      status: db ? 'ready' : 'degraded',
      checks: {
        database: db,
        redis: this.redis.isEnabled ? await this.redis.ping() : 'disabled',
        rabbitmqPublisher: this.rmq.enabled,
        uploads: this.s3.enabled ? 's3' : 'local',
      },
      ts: new Date().toISOString(),
    };
  }
}
