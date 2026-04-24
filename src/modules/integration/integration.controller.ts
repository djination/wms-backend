import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { RabbitMqPublisherService } from '../messaging/rabbitmq-publisher.service';
import { WMS_PATTERNS } from '../messaging/wms-events.controller';

/**
 * Example inbound webhook for third-party ERP / TMS.
 * If INTEGRATION_WEBHOOK_SECRET is set, require header x-webhook-secret (use TLS in production).
 */
@ApiTags('integration')
@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly config: ConfigService,
    private readonly rmq: RabbitMqPublisherService,
  ) {}

  @Post('webhooks/inbound')
  @HttpCode(202)
  @ApiOperation({ summary: 'Third-party inbound webhook' })
  @ApiHeader({ name: 'x-webhook-secret', required: false })
  async inboundWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ) {
    const secret = this.config.get<string>('INTEGRATION_WEBHOOK_SECRET');
    if (secret) {
      const a = Buffer.from(secret, 'utf8');
      const b = Buffer.from(webhookSecret ?? '', 'utf8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }
    if (this.rmq.enabled) {
      await this.rmq.emit(WMS_PATTERNS.INBOUND_RECEIVED, body);
    }
    return { accepted: true };
  }
}
