import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '../../generated/platform-prisma';
import { PlatformRoles } from './decorators/platform-roles.decorator';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformPlansService } from './platform-plans.service';

@ApiTags('platform')
@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
export class PlatformPlansController {
  constructor(private readonly plans: PlatformPlansService) {}

  @Get()
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT, PlatformRole.BILLING)
  @ApiOperation({ summary: 'List subscription plans' })
  list() {
    return this.plans.listPlans();
  }

  @Get(':id')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT, PlatformRole.BILLING)
  @ApiOperation({ summary: 'Get plan detail' })
  get(@Param('id') id: string) {
    return this.plans.getPlan(id);
  }

  @Patch(':id')
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.BILLING)
  @ApiOperation({ summary: 'Update subscription plan' })
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.updatePlan(id, dto);
  }
}
