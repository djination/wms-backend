import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createRequire } from 'module';
import { join } from 'path';
import { normalizeTenantSlug } from '../../common/platform/tenant-slug.util';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProvisionJobPayload, ProvisionTenantDto } from './dto/provision-tenant.dto';
import { ProvisioningQueueService } from './provisioning-queue.service';

const nodeRequire = createRequire(__filename);
const provisionPipeline = nodeRequire(
  join(process.cwd(), 'scripts/lib/provision-pipeline.cjs'),
) as {
  createProvisioningTenant: (
    platformDb: unknown,
    input: {
      slug: string;
      name: string;
      planCode?: string;
      adminEmail: string;
      adminPassword: string;
      adminName?: string;
    },
  ) => Promise<{ id: string; slug: string; schemaName: string; status: string }>;
  runProvisionPipeline: (
    platformDb: unknown,
    tenantDb: unknown,
    tenantId: string,
    admin: { email: string; password: string; name?: string },
  ) => Promise<{ tenantId: string; schemaName: string; status: string }>;
};

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly tenantDb: PrismaService,
    private readonly queue: ProvisioningQueueService,
  ) {}

  async createAndEnqueue(dto: ProvisionTenantDto) {
    const existing = await this.platformDb.tenant.findUnique({
      where: { slug: dto.slug.trim().toLowerCase() },
    });
    if (existing && existing.status !== 'CANCELLED') {
      throw new ConflictException(`Tenant slug already exists: ${dto.slug}`);
    }

    const tenant = await provisionPipeline.createProvisioningTenant(this.platformDb, {
      slug: dto.slug,
      name: dto.name,
      planCode: dto.planCode,
      adminEmail: dto.adminEmail,
      adminPassword: dto.adminPassword,
      adminName: dto.adminName,
    });

    const payload: ProvisionJobPayload = {
      tenantId: tenant.id,
      adminEmail: dto.adminEmail.toLowerCase(),
      adminPassword: dto.adminPassword,
      adminName: dto.adminName,
    };

    await this.queue.enqueue(payload);

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schemaName,
      status: tenant.status,
    };
  }

  async retryProvision(tenantId: string, admin?: { email: string; password: string; name?: string }) {
    const tenant = await this.platformDb.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${tenantId}`);

    if (!admin) {
      throw new ConflictException(
        'Retry requires admin credentials until tenant admin exists (pass adminEmail/adminPassword)',
      );
    }

    await this.platformDb.tenant.update({
      where: { id: tenantId },
      data: { status: 'PROVISIONING' },
    });

    await this.queue.enqueue({
      tenantId,
      adminEmail: admin.email.toLowerCase(),
      adminPassword: admin.password,
      adminName: admin.name,
    });

    return { tenantId, status: 'PROVISIONING' };
  }

  async runProvisionJob(payload: ProvisionJobPayload) {
    this.logger.log(`Provisioning tenant ${payload.tenantId}`);
    return provisionPipeline.runProvisionPipeline(this.platformDb, this.tenantDb, payload.tenantId, {
      email: payload.adminEmail,
      password: payload.adminPassword,
      name: payload.adminName,
    });
  }

  async getProvisionStatusBySlug(slug: string) {
    const normalized = normalizeTenantSlug(slug);
    const tenant = await this.platformDb.tenant.findUnique({ where: { slug: normalized } });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${slug}`);
    return this.getProvisionStatus(tenant.id);
  }

  async getProvisionStatus(tenantId: string) {
    const tenant = await this.platformDb.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${tenantId}`);

    const job = await this.platformDb.tenantProvisioningJob.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const ready = tenant.status === 'TRIAL' || tenant.status === 'ACTIVE';

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schemaName,
      status: tenant.status,
      provisionedAt: tenant.provisionedAt,
      ready,
      job: job
        ? {
            id: job.id,
            step: job.step,
            status: job.status,
            error: job.error,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
          }
        : null,
    };
  }
}
