import { AsyncLocalStorage } from 'async_hooks';
import { TenantContext } from './tenant-context.types';

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

export function getTenantSchemaName(): string | undefined {
  return tenantContextStorage.getStore()?.schemaName;
}
