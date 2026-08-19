import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getTenantContext } from '../../../common/tenant/tenant-context.storage';
import { PrismaService } from '../../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  email: string;
  tokenType?: 'tenant';
  roles: string[];
  operatorCompanyId?: string | null;
  canAccessWeb?: boolean;
  canAccessMobile?: boolean;
  warehouseIds?: string[];
  tenantId?: string;
  tenantSlug?: string;
  schemaName?: string;
  impersonatedBy?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if ((payload as { tokenType?: string }).tokenType === 'platform') {
      throw new UnauthorizedException('Platform token cannot access tenant API');
    }
    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException();
    }

    const activeTenant = getTenantContext();
    if (activeTenant) {
      if (payload.tenantId && payload.tenantId !== activeTenant.tenantId) {
        throw new UnauthorizedException('Token tenant mismatch');
      }
      if (payload.schemaName && payload.schemaName !== activeTenant.schemaName) {
        throw new UnauthorizedException('Token schema mismatch');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        operatorCompanyId: true,
        canAccessWeb: true,
        canAccessMobile: true,
        warehouseMappings: { select: { warehouseId: true } },
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return {
      sub: user.id,
      email: user.email,
      roles: user.userRoles.map((ur) => ur.role.code),
      operatorCompanyId: user.operatorCompanyId ?? null,
      canAccessWeb: user.canAccessWeb,
      canAccessMobile: user.canAccessMobile,
      warehouseIds: user.warehouseMappings.map((m) => m.warehouseId),
      tokenType: 'tenant',
      tenantId: activeTenant?.tenantId ?? payload.tenantId,
      tenantSlug: activeTenant?.slug ?? payload.tenantSlug,
      schemaName: activeTenant?.schemaName ?? payload.schemaName,
      impersonatedBy: payload.impersonatedBy,
    };
  }
}
