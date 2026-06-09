import { Module } from '@nestjs/common';
import { ImportConsignmentModule } from '../import-consignment/import-consignment.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';

@Module({
  imports: [PrismaModule, ImportConsignmentModule],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
