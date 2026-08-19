import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformAuditLogsController } from './platform-audit-logs.controller';
import { PlatformAuditLogsService } from './platform-audit-logs.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformFeatureFlagsController } from './platform-feature-flags.controller';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';
import { PlatformPlansController } from './platform-plans.controller';
import { PlatformPlansService } from './platform-plans.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';
import { PlatformUsersController } from './platform-users.controller';
import { PlatformUsersService } from './platform-users.service';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'platform-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('PLATFORM_JWT_SECRET') ?? config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('PLATFORM_JWT_EXPIRES_IN') ?? '8h',
        },
      }),
    }),
    AuthModule,
    ProvisioningModule,
  ],
  controllers: [
    PlatformAuthController,
    PlatformTenantsController,
    PlatformSettingsController,
    PlatformUsersController,
    PlatformPlansController,
    PlatformFeatureFlagsController,
    PlatformAuditLogsController,
  ],
  providers: [
    PlatformAuthService,
    PlatformTenantsService,
    PlatformSettingsService,
    PlatformUsersService,
    PlatformPlansService,
    PlatformFeatureFlagsService,
    PlatformAuditLogsService,
    PlatformAuditService,
    PlatformJwtStrategy,
    PlatformRolesGuard,
  ],
  exports: [PlatformAuthService, PlatformAuditService],
})
export class PlatformModule {}
