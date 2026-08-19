import { Module } from '@nestjs/common';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { TenantSignupController } from './tenant-signup.controller';
import { TenantSignupService } from './tenant-signup.service';

@Module({
  imports: [ProvisioningModule],
  controllers: [TenantSignupController],
  providers: [TenantSignupService],
})
export class TenantSignupModule {}
