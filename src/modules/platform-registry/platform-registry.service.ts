import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantStatus } from '../../generated/platform-prisma';
import {
  assertValidTenantSlug,
  normalizeTenantSlug,
  tenantSchemaNameFromSlug,
} from '../../common/platform/tenant-slug.util';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';

const MIGRATABLE_STATUSES: TenantStatus[] = [
  TenantStatus.PROVISIONING,
  TenantStatus.TRIAL,
  TenantStatus.ACTIVE,
  TenantStatus.PAST_DUE,
  TenantStatus.SUSPENDED,
];

@Injectable()
export class PlatformRegistryService {
  constructor(private readonly platformDb: PlatformPrismaService) {}

  resolveSchemaName(slug: string): string {
    assertValidTenantSlug(slug);
    return tenantSchemaNameFromSlug(slug);
  }

  async findBySlug(slug: string) {
    const normalized = normalizeTenantSlug(slug);
    return this.platformDb.tenant.findUnique({
      where: { slug: normalized },
      include: { plan: true, subscription: true },
    });
  }

  async findById(id: string) {
    return this.platformDb.tenant.findUnique({
      where: { id },
      include: { plan: true, subscription: true },
    });
  }

  async requireBySlug(slug: string) {
    const tenant = await this.findBySlug(slug);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${slug}`);
    }
    return tenant;
  }

  async listTenantsForMigration(): Promise<string[]> {
    const rows = await this.platformDb.tenant.findMany({
      where: { status: { in: MIGRATABLE_STATUSES } },
      select: { schemaName: true },
      orderBy: { schemaName: 'asc' },
    });
    return rows.map((r) => r.schemaName);
  }

  async listTenants(options?: { status?: TenantStatus[] }) {
    return this.platformDb.tenant.findMany({
      where: options?.status ? { status: { in: options.status } } : undefined,
      include: { plan: true, subscription: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLatestProvisioningJob(tenantId: string) {
    return this.platformDb.tenantProvisioningJob.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
