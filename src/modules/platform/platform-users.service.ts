import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { ResetPlatformUserPasswordDto } from './dto/reset-platform-user-password.dto';
import { UpdatePlatformUserDto } from './dto/update-platform-user.dto';

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async listUsers() {
    const items = await this.platformDb.platformUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { items };
  }

  async createUser(dto: CreatePlatformUserDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.platformDb.platformUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException(`Platform user already exists: ${email}`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.platformDb.platformUser.create({
      data: {
        email,
        passwordHash,
        name: dto.name?.trim() || null,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.log(actorId, 'PLATFORM_USER_CREATE', {
      metadata: { email: user.email, role: user.role },
    });
    return user;
  }

  async updateUser(id: string, dto: UpdatePlatformUserDto, actorId: string) {
    const existing = await this.platformDb.platformUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Platform user not found: ${id}`);

    if (dto.isActive === false && id === actorId) {
      throw new BadRequestException('Cannot deactivate your own platform account');
    }

    const user = await this.platformDb.platformUser.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() || null : undefined,
        role: dto.role,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.log(actorId, 'PLATFORM_USER_UPDATE', {
      metadata: { userId: id, changes: dto },
    });
    return user;
  }

  async resetPassword(id: string, dto: ResetPlatformUserPasswordDto, actorId: string) {
    const existing = await this.platformDb.platformUser.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Platform user not found: ${id}`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.platformDb.platformUser.update({
      where: { id },
      data: { passwordHash },
    });

    await this.audit.log(actorId, 'PLATFORM_USER_RESET_PASSWORD', {
      metadata: { userId: id },
    });
    return { ok: true };
  }
}
