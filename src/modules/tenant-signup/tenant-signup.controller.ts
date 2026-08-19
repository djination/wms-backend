import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProvisionTenantDto } from '../provisioning/dto/provision-tenant.dto';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { TenantSignupService } from './tenant-signup.service';

@ApiTags('tenants')
@Controller('tenants')
export class TenantSignupController {
  constructor(
    private readonly signup: TenantSignupService,
    private readonly provisioning: ProvisioningService,
  ) {}

  @Post('signup')
  @ApiOperation({ summary: 'Public tenant signup (provisions schema asynchronously)' })
  register(@Body() dto: ProvisionTenantDto) {
    return this.signup.signup(dto);
  }

  @Get(':slug/provision-status')
  @ApiOperation({ summary: 'Poll provisioning status until tenant is TRIAL/ACTIVE' })
  provisionStatus(@Param('slug') slug: string) {
    return this.provisioning.getProvisionStatusBySlug(slug);
  }
}
