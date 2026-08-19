import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { getTenantContext } from '../../common/tenant/tenant-context.storage';
import { TenantContext } from '../../common/tenant/tenant-context.types';
import { PrismaService } from '../prisma/prisma.service';
import { LoginPlatform } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  isOpenRegisterAllowed(): boolean {
    const explicit = this.config.get<string>('AUTH_ALLOW_OPEN_REGISTER');
    if (explicit === 'true' || explicit === '1') return true;
    if (explicit === 'false' || explicit === '0') return false;
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  async register(email: string, password: string, name?: string) {
    if (!this.isOpenRegisterAllowed()) {
      throw new ForbiddenException(
        'Open user registration is disabled. Use tenant signup or ask an administrator.',
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name },
    });
    return this.issueTenantTokens(user.id, user.email);
  }

  async login(email: string, password: string, platform: LoginPlatform = 'web') {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('User is inactive');
    if (platform === 'mobile' && !user.canAccessMobile) {
      throw new UnauthorizedException('User has no mobile access');
    }
    if (platform === 'web' && !user.canAccessWeb) {
      throw new UnauthorizedException('User has no web access');
    }
    return this.issueTenantTokens(user.id, user.email);
  }

  issueTenantTokens(
    sub: string,
    email: string,
    tenantOverride?: TenantContext,
    options?: { impersonatedBy?: string; expiresIn?: string },
  ) {
    return this.prisma.user
      .findUnique({
        where: { id: sub },
        select: {
          operatorCompanyId: true,
          canAccessWeb: true,
          canAccessMobile: true,
          warehouseMappings: { select: { warehouseId: true } },
          userRoles: { select: { role: { select: { code: true } } } },
        },
      })
      .then((userWithRoles) => {
        const tenant = tenantOverride ?? getTenantContext();
        const payload: JwtPayload = {
          sub,
          email,
          tokenType: 'tenant',
          roles: userWithRoles?.userRoles.map((ur) => ur.role.code) ?? [],
          operatorCompanyId: userWithRoles?.operatorCompanyId ?? null,
          canAccessWeb: userWithRoles?.canAccessWeb ?? false,
          canAccessMobile: userWithRoles?.canAccessMobile ?? false,
          warehouseIds: userWithRoles?.warehouseMappings.map((m) => m.warehouseId) ?? [],
          tenantId: tenant?.tenantId,
          tenantSlug: tenant?.slug,
          schemaName: tenant?.schemaName,
          impersonatedBy: options?.impersonatedBy,
        };
        const expiresIn = options?.expiresIn ?? process.env.JWT_EXPIRES_IN ?? '1d';
        const accessToken = this.jwt.sign(payload, { expiresIn });
        return { accessToken, tokenType: 'Bearer' as const, expiresIn };
      });
  }
}
