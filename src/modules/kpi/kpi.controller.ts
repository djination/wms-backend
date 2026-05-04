import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { KpiQueryDto } from './dto/kpi-query.dto';
import { KpiService } from './kpi.service';

@ApiTags('kpi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kpi')
export class KpiController {
  constructor(private readonly service: KpiService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Operational KPI snapshot: inbound, outbound, inventory, billing, process flow, plus transit-import customs dwell (open HELD + cleared in period)',
  })
  getSummary(@Query() query: KpiQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.getSummary(query, user);
  }
}
