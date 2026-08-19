import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantContext } from '../../common/tenant/tenant-context.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register user in current tenant schema (disabled in production unless AUTH_ALLOW_OPEN_REGISTER=true)',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  @ApiOperation({ summary: 'Obtain JWT for API & third-party integration' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.platform);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user from JWT' })
  me(@CurrentUser() user: JwtPayload, @CurrentTenant() tenant?: TenantContext) {
    return {
      ...user,
      tenant: tenant
        ? { id: tenant.tenantId, slug: tenant.slug, name: tenant.name, status: tenant.status }
        : null,
    };
  }
}
