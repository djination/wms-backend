import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';

@Module({
  imports: [PrismaModule],
  controllers: [OutboundController],
  providers: [OutboundService],
})
export class OutboundModule {}
