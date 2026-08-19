import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '../../../generated/platform-prisma';
import { PLATFORM_ROLES_KEY } from '../decorators/platform-roles.decorator';
import { PlatformJwtPayload } from '../strategies/platform-jwt.strategy';

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRole[]>(PLATFORM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ platformUser?: PlatformJwtPayload }>();
    const role = request.platformUser?.platformRole;
    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException('Insufficient platform role');
    }
    return true;
  }
}
