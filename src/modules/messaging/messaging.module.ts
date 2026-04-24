import { Module } from '@nestjs/common';
import { RabbitMqPublisherService } from './rabbitmq-publisher.service';
import { WmsEventsController } from './wms-events.controller';

@Module({
  controllers: [WmsEventsController],
  providers: [RabbitMqPublisherService],
  exports: [RabbitMqPublisherService],
})
export class MessagingModule {}
