import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginPlatform } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name },
    });
    return this.issueTokens(user.id, user.email);
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
    return this.issueTokens(user.id, user.email);
  }

  private issueTokens(sub: string, email: string) {
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
        const payload: JwtPayload = {
          sub,
          email,
          roles: userWithRoles?.userRoles.map((ur) => ur.role.code) ?? [],
          operatorCompanyId: userWithRoles?.operatorCompanyId ?? null,
          canAccessWeb: userWithRoles?.canAccessWeb ?? false,
          canAccessMobile: userWithRoles?.canAccessMobile ?? false,
          warehouseIds: userWithRoles?.warehouseMappings.map((m) => m.warehouseId) ?? [],
        };
        const accessToken = this.jwt.sign(payload);
        return { accessToken, tokenType: 'Bearer' as const, expiresIn: process.env.JWT_EXPIRES_IN ?? '1d' };
      });
  }
}
