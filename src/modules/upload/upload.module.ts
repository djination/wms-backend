import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [StorageModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
