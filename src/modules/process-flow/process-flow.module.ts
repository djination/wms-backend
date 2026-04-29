import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProcessFlowController } from './process-flow.controller';
import { ProcessFlowService } from './process-flow.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProcessFlowController],
  providers: [ProcessFlowService],
})
export class ProcessFlowModule {}
