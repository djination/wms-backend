import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PlatformRole } from '../../../generated/platform-prisma';
import { PlatformPrismaService } from '../../platform-prisma/platform-prisma.service';

export type PlatformJwtPayload = {
  sub: string;
  email: string;
  platformRole: PlatformRole;
  tokenType: 'platform';
};

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    config: ConfigService,
    private readonly platformDb: PlatformPrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('PLATFORM_JWT_SECRET') ?? config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformJwtPayload> {
    if (payload?.tokenType !== 'platform' || !payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Invalid platform token');
    }

    const user = await this.platformDb.platformUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Platform user inactive or not found');
    }

    return {
      sub: user.id,
      email: user.email,
      platformRole: user.role,
      tokenType: 'platform',
    };
  }
}
