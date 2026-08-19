import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentPlatformUser } from './decorators/current-platform-user.decorator';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtPayload } from './strategies/platform-jwt.strategy';

@ApiTags('platform')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Platform admin login (separate JWT from tenant users)' })
  login(@Body() dto: PlatformLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(PlatformJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current platform admin from JWT' })
  me(@CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.auth.getProfile(user.sub);
  }
}
