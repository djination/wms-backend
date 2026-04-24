import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

@Module({
  imports: [PrismaModule],
  controllers: [KpiController],
  providers: [KpiService],
})
export class KpiModule {}
