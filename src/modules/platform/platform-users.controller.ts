import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRole } from '../../generated/platform-prisma';
import { CurrentPlatformUser } from './decorators/current-platform-user.decorator';
import { PlatformRoles } from './decorators/platform-roles.decorator';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { ResetPlatformUserPasswordDto } from './dto/reset-platform-user-password.dto';
import { UpdatePlatformUserDto } from './dto/update-platform-user.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformUsersService } from './platform-users.service';
import { PlatformJwtPayload } from './strategies/platform-jwt.strategy';

@ApiTags('platform')
@Controller('platform/users')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
export class PlatformUsersController {
  constructor(private readonly users: PlatformUsersService) {}

  @Get()
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List platform admin users' })
  list() {
    return this.users.listUsers();
  }

  @Post()
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create platform admin user' })
  create(@Body() dto: CreatePlatformUserDto, @CurrentPlatformUser() user: PlatformJwtPayload) {
    return this.users.createUser(dto, user.sub);
  }

  @Patch(':id')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update platform admin user' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformUserDto,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.users.updateUser(id, dto, user.sub);
  }

  @Post(':id/reset-password')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reset platform admin password' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPlatformUserPasswordDto,
    @CurrentPlatformUser() user: PlatformJwtPayload,
  ) {
    return this.users.resetPassword(id, dto, user.sub);
  }
}
