import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PlatformJwtPayload } from '../strategies/platform-jwt.strategy';

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformJwtPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<{ platformUser?: PlatformJwtPayload }>();
    return request.platformUser;
  },
);
