import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '../../generated/platform-prisma';
import { PlatformRoles } from './decorators/platform-roles.decorator';
import { UpdatePlatformSettingDto } from './dto/update-platform-setting.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('platform')
@Controller('platform/settings')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'List platform settings (key-value JSON)' })
  list() {
    return this.settings.listSettings();
  }

  @Get(':key')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'Get single platform setting' })
  get(@Param('key') key: string) {
    return this.settings.getSetting(key);
  }

  @Put(':key')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create or update platform setting' })
  upsert(@Param('key') key: string, @Body() dto: UpdatePlatformSettingDto) {
    return this.settings.upsertSetting(key, dto.value);
  }
}
