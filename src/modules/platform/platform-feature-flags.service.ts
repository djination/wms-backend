import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_FEATURE_FLAG_CATALOG,
  FEATURE_FLAG_CATALOG_SETTING_KEY,
  FeatureFlagCatalogEntry,
} from './constants/feature-flag-catalog';
import { PlatformPrismaService } from '../platform-prisma/platform-prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import { UpdateFeatureFlagCatalogDto } from './dto/update-feature-flag-catalog.dto';
import { UpsertTenantFeatureFlagsDto } from './dto/upsert-tenant-feature-flags.dto';

@Injectable()
export class PlatformFeatureFlagsService {
  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  async getCatalog(): Promise<{ catalog: FeatureFlagCatalogEntry[] }> {
    const row = await this.platformDb.platformSetting.findUnique({
      where: { key: FEATURE_FLAG_CATALOG_SETTING_KEY },
    });
    const stored = row?.value as { catalog?: FeatureFlagCatalogEntry[] } | null;
    if (stored?.catalog?.length) {
      return { catalog: stored.catalog };
    }
    return { catalog: DEFAULT_FEATURE_FLAG_CATALOG };
  }

  async updateCatalog(dto: UpdateFeatureFlagCatalogDto, actorId: string) {
    await this.platformDb.platformSetting.upsert({
      where: { key: FEATURE_FLAG_CATALOG_SETTING_KEY },
      update: { value: { catalog: dto.catalog } as object },
      create: { key: FEATURE_FLAG_CATALOG_SETTING_KEY, value: { catalog: dto.catalog } as object },
    });
    await this.audit.log(actorId, 'FEATURE_FLAG_CATALOG_UPDATE', {
      metadata: { count: dto.catalog.length },
    });
    return { catalog: dto.catalog };
  }

  async getTenantFlags(tenantId: string) {
    const tenant = await this.platformDb.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${tenantId}`);

    const [catalogResult, flags] = await Promise.all([
      this.getCatalog(),
      this.platformDb.tenantFeatureFlag.findMany({
        where: { tenantId },
        orderBy: { flagKey: 'asc' },
      }),
    ]);

    const flagMap = new Map(flags.map((f) => [f.flagKey, f.enabled]));
    const items = catalogResult.catalog.map((entry) => ({
      flagKey: entry.key,
      label: entry.label,
      description: entry.description,
      enabled: flagMap.get(entry.key) ?? false,
    }));

    return { tenantId, items };
  }

  async upsertTenantFlags(
    tenantId: string,
    dto: UpsertTenantFeatureFlagsDto,
    actorId: string,
  ) {
    const tenant = await this.platformDb.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant not found: ${tenantId}`);

    await Promise.all(
      dto.flags.map((flag) =>
        this.platformDb.tenantFeatureFlag.upsert({
          where: {
            tenantId_flagKey: { tenantId, flagKey: flag.flagKey },
          },
          update: { enabled: flag.enabled },
          create: {
            tenantId,
            flagKey: flag.flagKey,
            enabled: flag.enabled,
          },
        }),
      ),
    );

    await this.audit.log(actorId, 'TENANT_FEATURE_FLAGS_UPDATE', {
      tenantId,
      metadata: { flags: dto.flags },
    });

    return this.getTenantFlags(tenantId);
  }
}
