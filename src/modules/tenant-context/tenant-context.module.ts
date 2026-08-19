import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformRegistryModule } from '../platform-registry/platform-registry.module';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TenantResolutionService } from './tenant-resolution.service';

@Module({
  imports: [PlatformRegistryModule, AuthModule],
  providers: [TenantResolutionService, TenantContextMiddleware],
  exports: [TenantResolutionService],
})
export class TenantContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        { path: 'docs', method: RequestMethod.ALL },
        { path: 'docs-json', method: RequestMethod.ALL },
        { path: 'docs/(.*)', method: RequestMethod.ALL },
        { path: 'platform/(.*)', method: RequestMethod.ALL },
        { path: 'tenants/signup', method: RequestMethod.POST },
        { path: 'tenants/:slug/provision-status', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
