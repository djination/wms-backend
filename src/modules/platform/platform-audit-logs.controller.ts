import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '../../generated/platform-prisma';
import { PlatformRoles } from './decorators/platform-roles.decorator';
import { PlatformAuditQueryDto } from './dto/platform-audit-query.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformAuditLogsService } from './platform-audit-logs.service';

@ApiTags('platform')
@Controller('platform/audit-logs')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
export class PlatformAuditLogsController {
  constructor(private readonly auditLogs: PlatformAuditLogsService) {}

  @Get()
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT)
  @ApiOperation({ summary: 'List platform audit logs' })
  list(@Query() query: PlatformAuditQueryDto) {
    return this.auditLogs.listLogs(query);
  }
}
