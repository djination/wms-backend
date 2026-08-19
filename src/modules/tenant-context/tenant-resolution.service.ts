import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TenantStatus } from '../../generated/platform-prisma';
import { isValidTenantSlug, normalizeTenantSlug } from '../../common/platform/tenant-slug.util';
import { TENANT_SLUG_HEADER, TenantContext } from '../../common/tenant/tenant-context.types';
import { PlatformRegistryService } from '../platform-registry/platform-registry.service';

const API_ALLOWED_STATUSES: TenantStatus[] = [
  TenantStatus.TRIAL,
  TenantStatus.ACTIVE,
  TenantStatus.PAST_DUE,
];

type JwtTenantClaims = {
  tenantId?: string;
  tenantSlug?: string;
  schemaName?: string;
};

@Injectable()
export class TenantResolutionService {
  private readonly logger = new Logger(TenantResolutionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: PlatformRegistryService,
    private readonly jwt: JwtService,
  ) {}

  async resolveForRequest(req: Request): Promise<TenantContext | undefined> {
    const slug = this.resolveSlug(req);
    if (!slug) {
      if (this.isTenantRequired()) {
        throw new BadRequestException(
          `Tenant slug required (header ${TENANT_SLUG_HEADER}, subdomain, or JWT tenant claim)`,
        );
      }
      return undefined;
    }

    const tenant = await this.registry.findBySlug(slug);
    if (!tenant) {
      throw new BadRequestException(`Unknown tenant: ${slug}`);
    }

    this.assertTenantAccessible(tenant.status, req.path);

    const jwtClaims = this.decodeJwtTenantClaims(req);
    if (jwtClaims?.tenantId && jwtClaims.tenantId !== tenant.id) {
      throw new ForbiddenException('JWT tenant does not match resolved tenant');
    }
    if (jwtClaims?.schemaName && jwtClaims.schemaName !== tenant.schemaName) {
      throw new ForbiddenException('JWT schema does not match resolved tenant');
    }

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schemaName,
      status: tenant.status,
      name: tenant.name,
    };
  }

  private isTenantRequired(): boolean {
    const explicit = this.config.get<string>('SAAS_TENANT_REQUIRED');
    if (explicit !== undefined) {
      return explicit === 'true' || explicit === '1';
    }
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private resolveSlug(req: Request): string | undefined {
    const fromJwt = this.decodeJwtTenantClaims(req);
    if (fromJwt?.tenantSlug && isValidTenantSlug(fromJwt.tenantSlug)) {
      return normalizeTenantSlug(fromJwt.tenantSlug);
    }

    const headerSlug = req.headers[TENANT_SLUG_HEADER];
    if (typeof headerSlug === 'string' && headerSlug.trim()) {
      const normalized = normalizeTenantSlug(headerSlug);
      if (isValidTenantSlug(normalized)) return normalized;
    }

    const body = req.body as { tenantSlug?: string } | undefined;
    if (body?.tenantSlug?.trim()) {
      const normalized = normalizeTenantSlug(body.tenantSlug);
      if (isValidTenantSlug(normalized)) return normalized;
    }

    const hostSlug = this.resolveSlugFromHost(req);
    if (hostSlug) return hostSlug;

    const defaultSlug = this.config.get<string>('TENANT_DEFAULT_SLUG')?.trim();
    if (defaultSlug && isValidTenantSlug(defaultSlug)) {
      return normalizeTenantSlug(defaultSlug);
    }

    return undefined;
  }

  private resolveSlugFromHost(req: Request): string | undefined {
    const baseDomain = this.config.get<string>('TENANT_BASE_DOMAIN')?.trim().toLowerCase();
    const host = (req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
      .toString()
      .split(',')[0]
      .trim()
      .toLowerCase()
      .split(':')[0];

    if (!host) return undefined;

    if (baseDomain && host.endsWith(`.${baseDomain}`)) {
      const slug = host.slice(0, -(baseDomain.length + 1));
      const first = slug.split('.')[0];
      if (first && isValidTenantSlug(first)) return normalizeTenantSlug(first);
    }

    if (host.endsWith('.localhost')) {
      const slug = host.replace(/\.localhost$/, '').split('.')[0];
      if (slug && isValidTenantSlug(slug)) return normalizeTenantSlug(slug);
    }

    return undefined;
  }

  private decodeJwtTenantClaims(req: Request): JwtTenantClaims | undefined {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return undefined;
    const token = auth.slice(7);
    try {
      const decoded = this.jwt.decode(token);
      if (!decoded || typeof decoded !== 'object') return undefined;
      const d = decoded as JwtTenantClaims;
      return {
        tenantId: d.tenantId,
        tenantSlug: d.tenantSlug,
        schemaName: d.schemaName,
      };
    } catch {
      this.logger.debug('Failed to decode JWT for tenant resolution');
      return undefined;
    }
  }

  private assertTenantAccessible(status: TenantStatus, path: string) {
    if (API_ALLOWED_STATUSES.includes(status)) return;

    if (status === TenantStatus.PROVISIONING && /provision-status/i.test(path)) {
      return;
    }

    if (status === TenantStatus.PROVISIONING) {
      throw new ForbiddenException('Tenant is still provisioning');
    }
    if (status === TenantStatus.SUSPENDED) {
      throw new ForbiddenException('Tenant is suspended');
    }
    if (status === TenantStatus.CANCELLED) {
      throw new ForbiddenException('Tenant is cancelled');
    }

    throw new ForbiddenException(`Tenant status not allowed: ${status}`);
  }
}
