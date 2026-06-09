import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { ImportConsignmentController } from './import-consignment.controller';
import { ImportConsignmentService } from './import-consignment.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ImportConsignmentController],
  providers: [ImportConsignmentService],
  exports: [ImportConsignmentService],
})
export class ImportConsignmentModule {}
