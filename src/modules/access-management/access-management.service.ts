import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRoleMenusDto } from './dto/assign-role-menus.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteMode } from './dto/delete-access-entity.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AccessManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        roleMenus: { include: { menu: true } },
        userRoles: { include: { user: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createRole(dto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          scope: dto.scope,
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Role code already exists');
    }
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    await this.ensureRoleExists(id);
    try {
      return await this.prisma.role.update({
        where: { id },
        data: {
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          scope: dto.scope,
          isActive: dto.isActive,
        },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Role code already exists');
    }
  }

  async deleteRole(id: string, mode: DeleteMode) {
    await this.ensureRoleExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.$transaction([
        this.prisma.userRole.deleteMany({ where: { roleId: id } }),
        this.prisma.roleMenu.deleteMany({ where: { roleId: id } }),
        this.prisma.role.delete({ where: { id } }),
      ]);
      return { success: true, mode, id };
    }

    await this.prisma.role.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true, mode, id };
  }

  async listMenus() {
    return this.prisma.menu.findMany({
      where: { isActive: true },
      include: { parent: true, children: { where: { isActive: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getMyMenus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        userRoles: {
          select: {
            role: {
              select: {
                roleMenus: { select: { menuId: true } },
              },
            },
          },
        },
      },
    });
    if (!user || !user.isActive) {
      throw new BadRequestException('User not found or inactive');
    }

    const menuIds = [
      ...new Set(user.userRoles.flatMap((ur) => ur.role.roleMenus.map((rm) => rm.menuId))),
    ];
    if (menuIds.length === 0) return [];

    const menus = await this.prisma.menu.findMany({
      where: {
        isActive: true,
        OR: [{ id: { in: menuIds } }, { children: { some: { id: { in: menuIds }, isActive: true } } }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    return menus.filter((m) => !m.parentId).map((m) => ({
      ...m,
      children: m.children.filter((c) => menuIds.includes(c.id)),
    }));
  }

  async createMenu(dto: CreateMenuDto) {
    if (dto.parentId) {
      const parent = await this.prisma.menu.findUnique({
        where: { id: dto.parentId },
        select: { id: true, isActive: true },
      });
      if (!parent || !parent.isActive) {
        throw new BadRequestException('Parent menu not found or inactive');
      }
    }
    try {
      return await this.prisma.menu.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          path: dto.path?.trim(),
          icon: dto.icon?.trim(),
          sortOrder: dto.sortOrder ?? 0,
          parentId: dto.parentId,
        },
        include: { parent: true, children: true },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Menu code already exists');
    }
  }

  async updateMenu(id: string, dto: UpdateMenuDto) {
    await this.ensureMenuExists(id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Menu cannot be its own parent');
      }
      const parent = await this.prisma.menu.findUnique({
        where: { id: dto.parentId },
        select: { id: true, isActive: true },
      });
      if (!parent || !parent.isActive) {
        throw new BadRequestException('Parent menu not found or inactive');
      }
    }

    try {
      return await this.prisma.menu.update({
        where: { id },
        data: {
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          path: dto.path?.trim(),
          icon: dto.icon?.trim(),
          sortOrder: dto.sortOrder,
          parentId: dto.parentId,
          isActive: dto.isActive,
        },
        include: { parent: true, children: true },
      });
    } catch (err) {
      this.rethrowUnique(err, 'Menu code already exists');
    }
  }

  async deleteMenu(id: string, mode: DeleteMode) {
    await this.ensureMenuExists(id);
    if (mode === DeleteMode.HARD) {
      const childrenCount = await this.prisma.menu.count({ where: { parentId: id } });
      if (childrenCount > 0) {
        throw new BadRequestException('Cannot hard delete menu that still has children');
      }

      await this.prisma.$transaction([
        this.prisma.roleMenu.deleteMany({ where: { menuId: id } }),
        this.prisma.menu.delete({ where: { id } }),
      ]);
      return { success: true, mode, id };
    }

    await this.prisma.menu.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true, mode, id };
  }

  async listUsers() {
    return this.prisma.user.findMany({
      include: {
        operatorCompany: true,
        warehouseMappings: { include: { warehouse: true } },
        userRoles: { include: { role: true } },
      },
      orderBy: [{ isActive: 'desc' }, { email: 'asc' }],
    });
  }

  async createUser(dto: CreateUserDto) {
    if (dto.operatorCompanyId) {
      await this.assertActiveOperatorCompany(dto.operatorCompanyId);
    }
    const warehouseIds = [...new Set(dto.warehouseIds ?? [])];
    if (warehouseIds.length > 0) {
      await this.assertActiveWarehouses(warehouseIds);
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          name: dto.name?.trim(),
          operatorCompanyId: dto.operatorCompanyId,
          canAccessWeb: dto.canAccessWeb ?? true,
          canAccessMobile: dto.canAccessMobile ?? false,
          passwordHash,
          warehouseMappings: warehouseIds.length
            ? {
                create: warehouseIds.map((warehouseId) => ({ warehouseId })),
              }
            : undefined,
          userRoles: dto.roleIds?.length
            ? {
                create: [...new Set(dto.roleIds)].map((roleId) => ({ roleId })),
              }
            : undefined,
        },
        include: {
          operatorCompany: true,
          warehouseMappings: { include: { warehouse: true } },
          userRoles: { include: { role: true } },
        },
      });
      return user;
    } catch (err) {
      this.rethrowUnique(err, 'Email already registered');
    }
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    await this.ensureUserExists(id);
    if (dto.operatorCompanyId) {
      await this.assertActiveOperatorCompany(dto.operatorCompanyId);
    }
    const warehouseIds = dto.warehouseIds ? [...new Set(dto.warehouseIds)] : undefined;
    if (warehouseIds && warehouseIds.length > 0) {
      await this.assertActiveWarehouses(warehouseIds);
    }
    const data: Prisma.UserUpdateInput = {
      email: dto.email?.trim().toLowerCase(),
      name: dto.name?.trim(),
      isActive: dto.isActive,
      canAccessWeb: dto.canAccessWeb,
      canAccessMobile: dto.canAccessMobile,
      ...(dto.operatorCompanyId !== undefined ? { operatorCompanyId: dto.operatorCompanyId } : {}),
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data,
        });
        if (warehouseIds !== undefined) {
          await tx.userWarehouse.deleteMany({ where: { userId: id } });
          if (warehouseIds.length > 0) {
            await tx.userWarehouse.createMany({
              data: warehouseIds.map((warehouseId) => ({ userId: id, warehouseId })),
            });
          }
        }
        return tx.user.findUnique({
          where: { id: updated.id },
          include: {
            operatorCompany: true,
            warehouseMappings: { include: { warehouse: true } },
            userRoles: { include: { role: true } },
          },
        });
      });
    } catch (err) {
      this.rethrowUnique(err, 'Email already registered');
    }
  }

  async deleteUser(id: string, mode: DeleteMode) {
    await this.ensureUserExists(id);
    if (mode === DeleteMode.HARD) {
      await this.prisma.$transaction([
        this.prisma.userWarehouse.deleteMany({ where: { userId: id } }),
        this.prisma.userRole.deleteMany({ where: { userId: id } }),
        this.prisma.user.delete({ where: { id } }),
      ]);
      return { success: true, mode, id };
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true, mode, id };
  }

  async assignUserRoles(dto: AssignUserRolesDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new BadRequestException('User not found or inactive');
    }
    const roleIds = [...new Set(dto.roleIds)];
    if (roleIds.length > 0) {
      const count = await this.prisma.role.count({
        where: { id: { in: roleIds }, isActive: true },
      });
      if (count !== roleIds.length) {
        throw new BadRequestException('One or more roles not found or inactive');
      }
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: dto.userId } }),
      ...(roleIds.length
        ? [
            this.prisma.userRole.createMany({
              data: roleIds.map((roleId) => ({ userId: dto.userId, roleId })),
            }),
          ]
        : []),
    ]);

    return this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        operatorCompany: true,
        warehouseMappings: { include: { warehouse: true } },
        userRoles: { include: { role: true } },
      },
    });
  }

  async assignRoleMenus(dto: AssignRoleMenusDto) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
      select: { id: true, isActive: true },
    });
    if (!role || !role.isActive) {
      throw new BadRequestException('Role not found or inactive');
    }
    const menuIds = [...new Set(dto.menuIds)];
    if (menuIds.length > 0) {
      const count = await this.prisma.menu.count({
        where: { id: { in: menuIds }, isActive: true },
      });
      if (count !== menuIds.length) {
        throw new BadRequestException('One or more menus not found or inactive');
      }
    }

    await this.prisma.$transaction([
      this.prisma.roleMenu.deleteMany({ where: { roleId: dto.roleId } }),
      ...(menuIds.length
        ? [
            this.prisma.roleMenu.createMany({
              data: menuIds.map((menuId) => ({ roleId: dto.roleId, menuId })),
            }),
          ]
        : []),
    ]);

    return this.prisma.role.findUnique({
      where: { id: dto.roleId },
      include: { roleMenus: { include: { menu: true } } },
    });
  }

  private async ensureRoleExists(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  private async ensureMenuExists(id: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!menu) {
      throw new NotFoundException('Menu not found');
    }
    return menu;
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async assertActiveOperatorCompany(id: string) {
    const row = await this.prisma.operatorCompany.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!row || !row.isActive) {
      throw new BadRequestException('Operator company not found or inactive');
    }
  }

  private async assertActiveWarehouses(ids: string[]) {
    const count = await this.prisma.warehouse.count({
      where: { id: { in: ids }, isActive: true },
    });
    if (count !== ids.length) {
      throw new BadRequestException('One or more warehouses not found or inactive');
    }
  }

  private rethrowUnique(err: unknown, message: string): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw err;
  }
}
