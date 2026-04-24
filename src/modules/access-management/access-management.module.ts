import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessManagementController } from './access-management.controller';
import { AccessManagementService } from './access-management.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccessManagementController],
  providers: [AccessManagementService],
})
export class AccessManagementModule {}
