import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProvisionTenantDto } from '../provisioning/dto/provision-tenant.dto';
import { ProvisioningService } from '../provisioning/provisioning.service';

@Injectable()
export class TenantSignupService {
  constructor(
    private readonly config: ConfigService,
    private readonly provisioning: ProvisioningService,
  ) {}

  isSignupEnabled(): boolean {
    const explicit = this.config.get<string>('TENANT_SIGNUP_ENABLED');
    if (explicit === 'true' || explicit === '1') return true;
    if (explicit === 'false' || explicit === '0') return false;
    return true;
  }

  async signup(dto: ProvisionTenantDto) {
    if (!this.isSignupEnabled()) {
      throw new ForbiddenException('Tenant self-service signup is disabled');
    }

    const planCode =
      dto.planCode?.trim() ||
      this.config.get<string>('SIGNUP_DEFAULT_PLAN_CODE')?.trim() ||
      'STARTER';

    const result = await this.provisioning.createAndEnqueue({
      ...dto,
      planCode,
    });

    return {
      ...result,
      message: 'Tenant is being provisioned',
      pollPath: `/tenants/${result.slug}/provision-status`,
    };
  }
}
