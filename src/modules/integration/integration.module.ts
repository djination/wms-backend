import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { IntegrationController } from './integration.controller';

@Module({
  imports: [MessagingModule],
  controllers: [IntegrationController],
})
export class IntegrationModule {}
