import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context.types';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const request = ctx.switchToHttp().getRequest<{ tenant?: TenantContext }>();
    return request.tenant;
  },
);
