import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InboundController } from './inbound.controller';
import { InboundService } from './inbound.service';

@Module({
  imports: [PrismaModule],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
