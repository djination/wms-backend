import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PlatformRole } from '../../generated/platform-prisma';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';
import { PlatformJwtPayload } from './strategies/platform-jwt.strategy';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.platformDb.platformUser.findUnique({ where: { email: normalized } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Platform user is inactive');
    return this.issueToken(user.id, user.email, user.role);
  }

  async getProfile(platformUserId: string) {
    const user = await this.platformDb.platformUser.findUnique({
      where: { id: platformUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });
    if (!user) throw new UnauthorizedException('Platform user not found');
    return user;
  }

  issueToken(platformUserId: string, email: string, platformRole: PlatformRole) {
    const payload: PlatformJwtPayload = {
      sub: platformUserId,
      email,
      platformRole,
      tokenType: 'platform',
    };
    const expiresIn = this.config.get<string>('PLATFORM_JWT_EXPIRES_IN') ?? '8h';
    const accessToken = this.jwt.sign(payload, {
      secret:
        this.config.get<string>('PLATFORM_JWT_SECRET') ?? this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn,
    });
    return { accessToken, tokenType: 'Bearer' as const, expiresIn };
  }
}
