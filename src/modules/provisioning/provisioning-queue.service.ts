import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ProvisionJobPayload } from './dto/provision-tenant.dto';

type ProvisionProcessor = {
  runProvisionJob(payload: ProvisionJobPayload): Promise<unknown>;
};

@Injectable()
export class ProvisioningQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ProvisioningQueueService.name);
  private readonly queue: ProvisionJobPayload[] = [];
  private processing = false;
  private draining = false;
  private serviceRef: ProvisionProcessor | null = null;

  setProcessor(service: ProvisionProcessor) {
    this.serviceRef = service;
    void this.drain();
  }

  async enqueue(payload: ProvisionJobPayload): Promise<void> {
    this.queue.push(payload);
    void this.drain();
  }

  onModuleDestroy() {
    this.draining = true;
  }

  private async drain(): Promise<void> {
    if (this.processing || this.draining || !this.serviceRef) return;
    this.processing = true;

    try {
      while (this.queue.length > 0 && this.serviceRef) {
        const job = this.queue.shift();
        if (!job) break;
        try {
          await this.serviceRef.runProvisionJob(job);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Provision failed for tenant ${job.tenantId}: ${message}`);
        }
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0 && !this.draining) {
        void this.drain();
      }
    }
  }
}
