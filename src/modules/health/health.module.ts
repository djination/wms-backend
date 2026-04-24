import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { StorageModule } from '../storage/storage.module';
import { HealthController } from './health.controller';

@Module({
  imports: [MessagingModule, StorageModule],
  controllers: [HealthController],
})
export class HealthModule {}
