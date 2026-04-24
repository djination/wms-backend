import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AccessManagementService } from './access-management.service';
import { AssignRoleMenusDto } from './dto/assign-role-menus.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteAccessEntityDto, DeleteMode } from './dto/delete-access-entity.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('access-management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('access')
export class AccessManagementController {
  constructor(private readonly service: AccessManagementService) {}

  @Get('my-menus')
  @ApiOperation({ summary: 'Get current user menus by role mapping' })
  myMenus(@CurrentUser() user: JwtPayload) {
    return this.service.getMyMenus(user.sub);
  }

  @Get('roles')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'List roles and mapped menus/users' })
  listRoles() {
    return this.service.listRoles();
  }

  @Post('roles')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Create role' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.service.createRole(dto);
  }

  @Patch('roles/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Update role' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Delete role (soft/hard)' })
  deleteRole(@Param('id') id: string, @Query() query: DeleteAccessEntityDto) {
    return this.service.deleteRole(id, query.mode ?? DeleteMode.SOFT);
  }

  @Post('roles/assign-menus')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Replace role menu mapping' })
  assignRoleMenus(@Body() dto: AssignRoleMenusDto) {
    return this.service.assignRoleMenus(dto);
  }

  @Get('menus')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'List menus' })
  listMenus() {
    return this.service.listMenus();
  }

  @Post('menus')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Create menu' })
  createMenu(@Body() dto: CreateMenuDto) {
    return this.service.createMenu(dto);
  }

  @Patch('menus/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Update menu' })
  updateMenu(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.service.updateMenu(id, dto);
  }

  @Delete('menus/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Delete menu (soft/hard)' })
  deleteMenu(@Param('id') id: string, @Query() query: DeleteAccessEntityDto) {
    return this.service.deleteMenu(id, query.mode ?? DeleteMode.SOFT);
  }

  @Get('users')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'List users with roles' })
  listUsers() {
    return this.service.listUsers();
  }

  @Post('users')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Create user and optional roles' })
  createUser(@Body() dto: CreateUserDto) {
    return this.service.createUser(dto);
  }

  @Patch('users/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Update user' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.updateUser(id, dto);
  }

  @Delete('users/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Delete user (soft/hard)' })
  deleteUser(@Param('id') id: string, @Query() query: DeleteAccessEntityDto) {
    return this.service.deleteUser(id, query.mode ?? DeleteMode.SOFT);
  }

  @Post('users/assign-roles')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ summary: 'Replace user role mapping' })
  assignUserRoles(@Body() dto: AssignUserRolesDto) {
    return this.service.assignUserRoles(dto);
  }
}
