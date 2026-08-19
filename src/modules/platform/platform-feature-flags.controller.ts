import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '../../generated/platform-prisma';
import { CurrentPlatformUser } from './decorators/current-platform-user.decorator';
import { PlatformRoles } from './decorators/platform-roles.decorator';
import { UpdateFeatureFlagCatalogDto } from './dto/update-feature-flag-catalog.dto';
import { UpsertTenantFeatureFlagsDto } from './dto/upsert-tenant-feature-flags.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';
import { PlatformJwtPayload } from './strategies/platform-jwt.strategy';

@ApiTags('platform')
@Controller('platform/feature-flags')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
export class PlatformFeatureFlagsController {
  constructor(private readonly featureFlags: PlatformFeatureFlagsService) {}

  @Get('catalog')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'Feature flag catalog (global definitions)' })
  getCatalog() {
    return this.featureFlags.getCatalog();
  }

  @Put('catalog')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update feature flag catalog' })
  updateCatalog(
    @Body() dto: UpdateFeatureFlagCatalogDto,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.featureFlags.updateCatalog(dto, user.sub);
  }

  @Get('tenants/:tenantId')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'Tenant feature flags merged with catalog' })
  getTenantFlags(@Param('tenantId') tenantId: string) {
    return this.featureFlags.getTenantFlags(tenantId);
  }

  @Put('tenants/:tenantId')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'Upsert tenant feature flags' })
  upsertTenantFlags(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertTenantFeatureFlagsDto,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.featureFlags.upsertTenantFlags(tenantId, dto, user.sub);
  }
}
