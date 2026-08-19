import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { tenantContextStorage } from '../../common/tenant/tenant-context.storage';
import { TenantContext } from '../../common/tenant/tenant-context.types';
import { TenantResolutionService } from './tenant-resolution.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly resolution: TenantResolutionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = await this.resolution.resolveForRequest(req);
      (req as Request & { tenant?: TenantContext }).tenant = tenant;

      if (!tenant) {
        return next();
      }

      return tenantContextStorage.run(tenant, () => next());
    } catch (err) {
      next(err);
    }
  }
}
