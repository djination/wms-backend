import { TenantStatus } from '../../generated/platform-prisma';

export type TenantContext = {
  tenantId: string;
  slug: string;
  schemaName: string;
  status: TenantStatus;
  name: string;
};

export const TENANT_SLUG_HEADER = 'x-tenant-slug';
