const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,30}$/;
const SCHEMA_PATTERN = /^tenant_[a-z0-9_]+$/;

export function normalizeTenantSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidTenantSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function tenantSchemaNameFromSlug(slug: string): string {
  const normalized = normalizeTenantSlug(slug);
  return `tenant_${normalized.replace(/-/g, '_')}`;
}

export function isValidTenantSchemaName(schemaName: string): boolean {
  return SCHEMA_PATTERN.test(schemaName);
}

export function assertValidTenantSlug(slug: string): void {
  const normalized = normalizeTenantSlug(slug);
  if (!isValidTenantSlug(normalized)) {
    throw new Error(
      `Invalid tenant slug "${slug}". Use lowercase letters, numbers, hyphens; 3–31 chars; start with a letter.`,
    );
  }
}
