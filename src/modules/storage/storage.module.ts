import { Module } from '@nestjs/common';
import { OBJECT_STORAGE } from './ports/object-storage.port';
import { LocalObjectStorageService } from './local-object-storage.service';
import { S3ObjectStorageService } from './s3-object-storage.service';

@Module({
  providers: [
    S3ObjectStorageService,
    LocalObjectStorageService,
    {
      provide: OBJECT_STORAGE,
      useFactory: (s3: S3ObjectStorageService, local: LocalObjectStorageService) =>
        s3.enabled ? s3 : local,
      inject: [S3ObjectStorageService, LocalObjectStorageService],
    },
  ],
  exports: [OBJECT_STORAGE, S3ObjectStorageService, LocalObjectStorageService],
})
export class StorageModule {}
