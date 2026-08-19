import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '../../generated/platform-prisma';
import { ProvisionTenantDto } from '../provisioning/dto/provision-tenant.dto';
import { CurrentPlatformUser } from './decorators/current-platform-user.decorator';
import { PlatformRoles } from './decorators/platform-roles.decorator';
import { ImpersonateTenantDto } from './dto/impersonate-tenant.dto';
import { PlatformTenantQueryDto } from './dto/platform-tenant-query.dto';
import { RetryProvisionDto } from './dto/retry-provision.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformJwtPayload } from './strategies/platform-jwt.strategy';

@ApiTags('platform')
@Controller('platform/tenants')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
export class PlatformTenantsController {
  constructor(private readonly tenants: PlatformTenantsService) {}

  @Get()
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT, PlatformRole.BILLING)
  @ApiOperation({ summary: 'List tenants (platform registry)' })
  list(@Query() query: PlatformTenantQueryDto) {
    return this.tenants.listTenants(query);
  }

  @Get(':id/provision-status')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'Latest provisioning job status' })
  provisionStatus(@Param('id') id: string) {
    return this.tenants.getProvisionStatus(id);
  }

  @Get(':id')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT, PlatformRole.BILLING)
  @ApiOperation({ summary: 'Tenant detail + usage counts' })
  get(@Param('id') id: string) {
    return this.tenants.getTenant(id);
  }

  @Post()
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'Register tenant and enqueue provisioning' })
  create(@Body() dto: ProvisionTenantDto, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.tenants.createTenant(dto, user.sub);
  }

  @Patch(':id/suspend')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend tenant (blocks tenant API login)' })
  suspend(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.tenants.suspendTenant(id, user.sub);
  }

  @Patch(':id/reactivate')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reactivate suspended tenant' })
  reactivate(@Param('id') id: string, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.tenants.reactivateTenant(id, user.sub);
  }

  @Post(':id/retry-provision')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'Retry failed tenant provisioning' })
  retryProvision(
    @Param('id') id: string,
    @Body() dto: RetryProvisionDto,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.tenants.retryProvision(id, dto, user.sub);
  }

  @Post(':id/impersonate')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Issue short-lived tenant JWT for support (audited)' })
  impersonate(
    @Param('id') id: string,
    @Body() dto: ImpersonateTenantDto,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.tenants.impersonate(id, dto, user.sub);
  }
}
