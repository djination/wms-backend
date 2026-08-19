import { Module } from '@nestjs/common';
import { PlatformRegistryService } from './platform-registry.service';

@Module({
  providers: [PlatformRegistryService],
  exports: [PlatformRegistryService],
})
export class PlatformRegistryModule {}
