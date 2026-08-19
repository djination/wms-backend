import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlatformJwtPayload } from '../strategies/platform-jwt.strategy';

@Injectable()
export class PlatformJwtAuthGuard extends AuthGuard('platform-jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = PlatformJwtPayload>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException(info || 'Unauthorized');
    }
    const request = context.switchToHttp().getRequest<{ platformUser?: PlatformJwtPayload }>();
    request.platformUser = user as unknown as PlatformJwtPayload;
    return user;
  }
}
