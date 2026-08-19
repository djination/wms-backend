import { TenantContext } from '../common/tenant/tenant-context.types';
import { PlatformJwtPayload } from '../modules/platform/strategies/platform-jwt.strategy';

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      platformUser?: PlatformJwtPayload;
    }
  }
}

export {};
