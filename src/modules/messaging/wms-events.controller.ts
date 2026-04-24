import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

export const WMS_PATTERNS = {
  PING: 'wms.ping',
  INBOUND_RECEIVED: 'wms.inbound.received',
} as const;

@Controller()
export class WmsEventsController {
  private readonly logger = new Logger(WmsEventsController.name);

  @MessagePattern(WMS_PATTERNS.PING)
  handlePing(@Payload() data: { requestId?: string }) {
    this.logger.debug(`RMQ ping ${data?.requestId ?? ''}`);
    return { ok: true, ts: new Date().toISOString(), requestId: data?.requestId };
  }

  @MessagePattern(WMS_PATTERNS.INBOUND_RECEIVED)
  handleInbound(@Payload() payload: unknown) {
    this.logger.log(`RMQ inbound event: ${JSON.stringify(payload).slice(0, 500)}`);
    return { ok: true };
  }
}
