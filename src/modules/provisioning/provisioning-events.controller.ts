import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProvisionJobPayload } from './dto/provision-tenant.dto';
import { ProvisioningService } from './provisioning.service';

export const WMS_PROVISIONING_PATTERNS = {
  TENANT_PROVISION: 'wms.tenant.provision',
} as const;

@Controller()
export class ProvisioningEventsController {
  private readonly logger = new Logger(ProvisioningEventsController.name);

  constructor(private readonly provisioning: ProvisioningService) {}

  @MessagePattern(WMS_PROVISIONING_PATTERNS.TENANT_PROVISION)
  async handleTenantProvision(@Payload() payload: ProvisionJobPayload) {
    this.logger.log(`RMQ tenant provision: ${payload?.tenantId ?? 'unknown'}`);
    await this.provisioning.runProvisionJob(payload);
    return { ok: true, tenantId: payload.tenantId };
  }
}
