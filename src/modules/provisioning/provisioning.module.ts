import { Module, OnModuleInit } from '@nestjs/common';
import { ProvisioningEventsController } from './provisioning-events.controller';
import { ProvisioningQueueService } from './provisioning-queue.service';
import { ProvisioningService } from './provisioning.service';

@Module({
  controllers: [ProvisioningEventsController],
  providers: [ProvisioningService, ProvisioningQueueService],
  exports: [ProvisioningService, ProvisioningQueueService],
})
export class ProvisioningModule implements OnModuleInit {
  constructor(
    private readonly provisioning: ProvisioningService,
    private readonly queue: ProvisioningQueueService,
  ) {}

  onModuleInit() {
    this.queue.setProcessor(this.provisioning);
  }
}
