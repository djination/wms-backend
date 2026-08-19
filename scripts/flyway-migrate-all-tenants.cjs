/**
 * Migrate all tenant schemas from platform.tenants (+ env fallback).
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

function listSchemasFromEnv() {
  const explicit = process.env.FLYWAY_TENANT_SCHEMAS?.trim();
  if (explicit) {
    return explicit
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const dev = process.env.FLYWAY_DEV_TENANT_SCHEMA?.trim();
  if (dev) return [dev];
  return [];
}

async function listSchemasFromPlatform() {
  try {
    const clientPath = path.join(__dirname, '../src/generated/platform-prisma');
    const { PrismaClient } = require(clientPath);
    const prisma = new PrismaClient();
    const rows = await prisma.tenant.findMany({
      where: {
        status: { not: 'CANCELLED' },
      },
      select: { schemaName: true },
      orderBy: { schemaName: 'asc' },
    });
    await prisma.$disconnect();
    return rows.map((r) => r.schemaName);
  } catch {
    return [];
  }
}

async function main() {
  let schemas = listSchemasFromEnv();
  if (schemas.length === 0) {
    schemas = await listSchemasFromPlatform();
  }

  if (schemas.length === 0) {
    console.warn(
      'No tenant schemas to migrate. Register tenants in platform.tenants, or set FLYWAY_DEV_TENANT_SCHEMA / FLYWAY_TENANT_SCHEMAS.',
    );
    process.exit(0);
  }

  const unique = [...new Set(schemas)];

  for (const schema of unique) {
    console.log(`\n>>> Flyway migrate tenant schema: ${schema}`);
    const result = spawnSync('node', [path.join(__dirname, 'flyway-migrate-tenant.cjs'), schema], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
    });
    if ((result.status ?? 1) !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  console.log(`\nMigrated ${unique.length} tenant schema(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
