import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantStatus } from '../../generated/platform-prisma';
import { tenantContextStorage } from '../../common/tenant/tenant-context.storage';
import { TenantContext } from '../../common/tenant/tenant-context.types';
import { AuthService } from '../auth/auth.service';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformTenantQueryDto } from './dto/platform-tenant-query.dto';
import { ImpersonateTenantDto } from './dto/impersonate-tenant.dto';
import { RetryProvisionDto } from './dto/retry-provision.dto';
import { ProvisionTenantDto } from '../provisioning/dto/provision-tenant.dto';

@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly tenantDb: PrismaService,
    private readonly provisioning: ProvisioningService,
    private readonly audit: PlatformAuditService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async listTenants(query: PlatformTenantQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = query.status ? { status: query.status } : undefined;

    const [items, total] = await Promise.all([
      this.platformDb.tenant.findMany({
        where,
        include: { plan: true, subscription: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.platformDb.tenant.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getTenant(id: string) {
    const tenant = await this.platformDb.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        subscription: true,
        provisioningJobs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${id}`);
    const usage = await this.getTenantUsage(tenant.schemaName);
    return { ...tenant, usage };
  }

  async getProvisionStatus(tenantId: string) {
    return this.provisioning.getProvisionStatus(tenantId);
  }

  async createTenant(dto: ProvisionTenantDto, platformUserId: string) {
    const result = await this.provisioning.createAndEnqueue(dto);
    await this.audit.log(platformUserId, 'TENANT_CREATE', {
      tenantId: result.tenantId,
      metadata: { slug: result.slug, schemaName: result.schemaName },
    });
    return result;
  }

  async suspendTenant(id: string, platformUserId: string) {
    const tenant = await this.updateTenantStatus(id, TenantStatus.SUSPENDED);
    await this.audit.log(platformUserId, 'TENANT_SUSPEND', { tenantId: id });
    return tenant;
  }

  async reactivateTenant(id: string, platformUserId: string) {
    const current = await this.platformDb.tenant.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Tenant not found: ${id}`);
    if (current.status !== TenantStatus.SUSPENDED && current.status !== TenantStatus.PAST_DUE) {
      throw new BadRequestException(`Tenant cannot be reactivated from status ${current.status}`);
    }
    const nextStatus =
      current.provisionedAt != null ? TenantStatus.ACTIVE : TenantStatus.TRIAL;
    const tenant = await this.platformDb.tenant.update({
      where: { id },
      data: { status: nextStatus },
      include: { plan: true, subscription: true },
    });
    await this.audit.log(platformUserId, 'TENANT_REACTIVATE', {
      tenantId: id,
      metadata: { status: nextStatus },
    });
    return tenant;
  }

  async retryProvision(id: string, dto: RetryProvisionDto, platformUserId: string) {
    const result = await this.provisioning.retryProvision(id, {
      email: dto.adminEmail,
      password: dto.adminPassword,
      name: dto.adminName,
    });
    await this.audit.log(platformUserId, 'TENANT_RETRY_PROVISION', { tenantId: id });
    return result;
  }

  async impersonate(id: string, dto: ImpersonateTenantDto, platformUserId: string) {
    const tenant = await this.platformDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${id}`);
    const impersonatable: TenantStatus[] = [
      TenantStatus.TRIAL,
      TenantStatus.ACTIVE,
      TenantStatus.PAST_DUE,
    ];
    if (!impersonatable.includes(tenant.status)) {
      throw new BadRequestException(`Cannot impersonate tenant with status ${tenant.status}`);
    }

    const tenantCtx: TenantContext = {
      tenantId: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schemaName,
      status: tenant.status,
      name: tenant.name,
    };

    const tokenResponse = await tenantContextStorage.run(tenantCtx, async () => {
      const user = await this.resolveTenantAdminUser(dto.adminEmail);
      return this.auth.issueTenantTokens(user.id, user.email, tenantCtx, {
        impersonatedBy: platformUserId,
        expiresIn: this.config.get<string>('PLATFORM_IMPERSONATION_EXPIRES_IN') ?? '15m',
      });
    });

    await this.audit.log(platformUserId, 'TENANT_IMPERSONATE', {
      tenantId: id,
      metadata: { adminEmail: dto.adminEmail },
    });

    return {
      ...tokenResponse,
      tenant: { id: tenant.id, slug: tenant.slug, schemaName: tenant.schemaName },
    };
  }

  private async resolveTenantAdminUser(adminEmail?: string) {
    if (adminEmail) {
      const user = await this.tenantDb.user.findUnique({
        where: { email: adminEmail.trim().toLowerCase() },
      });
      if (!user?.isActive) throw new NotFoundException(`Tenant admin not found: ${adminEmail}`);
      return user;
    }

    const adminRole = await this.tenantDb.role.findFirst({
      where: { code: 'SYSTEM_ADMIN', isActive: true },
      include: {
        userRoles: {
          where: { user: { isActive: true } },
          include: { user: true },
          take: 1,
        },
      },
    });
    const user = adminRole?.userRoles[0]?.user;
    if (!user) {
      throw new NotFoundException('No active SYSTEM_ADMIN user found in tenant');
    }
    return user;
  }

  private async updateTenantStatus(id: string, status: TenantStatus) {
    const existing = await this.platformDb.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Tenant not found: ${id}`);
    return this.platformDb.tenant.update({
      where: { id },
      data: { status },
      include: { plan: true, subscription: true },
    });
  }

  private async getTenantUsage(schemaName: string) {
    const ctx: TenantContext = {
      tenantId: '',
      slug: '',
      schemaName,
      status: TenantStatus.ACTIVE,
      name: '',
    };

    return tenantContextStorage.run(ctx, async () => {
      const [users, warehouses, customers] = await Promise.all([
        this.tenantDb.user.count({ where: { isActive: true } }),
        this.tenantDb.warehouse.count({ where: { isActive: true } }),
        this.tenantDb.customer.count({ where: { isActive: true } }),
      ]);
      return { users, warehouses, customers };
    });
  }
}
