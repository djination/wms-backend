import { Prisma, PrismaClient } from '@prisma/client';
import { isValidTenantSchemaName } from '../../common/platform/tenant-slug.util';
import { getTenantSchemaName } from '../../common/tenant/tenant-context.storage';

const PUBLIC_SCHEMA = 'public';
const clientCache = new Map<string, PrismaClient>();

function stripSchemaFromDatabaseUrl(url: string): string {
  if (!url?.trim()) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('schema');
    return parsed.toString();
  } catch {
    return url.replace(/([?&])schema=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  }
}

function baseDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return stripSchemaFromDatabaseUrl(url);
}

function databaseUrlForSchema(schemaName: string): string {
  const base = baseDatabaseUrl();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}schema=${encodeURIComponent(schemaName)}`;
}

function getPrismaClientForSchema(schemaName: string): PrismaClient {
  let client = clientCache.get(schemaName);
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: databaseUrlForSchema(schemaName) } },
    });
    clientCache.set(schemaName, client);
  }
  return client;
}

function resolveSchemaName(): string {
  const schema = getTenantSchemaName();
  if (schema && isValidTenantSchemaName(schema)) {
    return schema;
  }
  return PUBLIC_SCHEMA;
}

function modelDelegateKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type ModelDelegate = Record<string, (args: unknown) => Promise<unknown>>;

async function delegateModelOperation(
  model: string,
  operation: string,
  args: unknown,
  fallbackQuery: (args: unknown) => Promise<unknown>,
): Promise<unknown> {
  const schema = resolveSchemaName();
  if (schema === PUBLIC_SCHEMA) {
    return fallbackQuery(args);
  }

  const client = getPrismaClientForSchema(schema);
  const delegate = (client as unknown as Record<string, ModelDelegate>)[modelDelegateKey(model)];
  const handler = delegate?.[operation];
  if (!handler) {
    return fallbackQuery(args);
  }
  return handler(args);
}

function clientForCurrentSchema(): PrismaClient {
  return getPrismaClientForSchema(resolveSchemaName());
}

export async function disconnectTenantPrismaClients(): Promise<void> {
  await Promise.all([...clientCache.values()].map((client) => client.$disconnect()));
  clientCache.clear();
}

export function createTenantAwarePrismaClient() {
  const base = getPrismaClientForSchema(PUBLIC_SCHEMA);

  return base.$extends({
    name: 'tenantSchemaRouting',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          return delegateModelOperation(model, operation, args, query);
        },
      },
    },
    client: {
      $queryRaw(...args: [query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]]) {
        return clientForCurrentSchema().$queryRaw(...(args as [Prisma.Sql]));
      },
      $executeRaw(...args: [query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]]) {
        return clientForCurrentSchema().$executeRaw(...(args as [Prisma.Sql]));
      },
      $queryRawUnsafe(...args: [string, ...unknown[]]) {
        return clientForCurrentSchema().$queryRawUnsafe(...args);
      },
      $executeRawUnsafe(...args: [string, ...unknown[]]) {
        return clientForCurrentSchema().$executeRawUnsafe(...args);
      },
      $transaction(
        fnOrQueries: unknown,
        options?: unknown,
      ) {
        return clientForCurrentSchema().$transaction(fnOrQueries as never, options as never);
      },
    },
  });
}

export type TenantAwarePrismaClient = ReturnType<typeof createTenantAwarePrismaClient>;
