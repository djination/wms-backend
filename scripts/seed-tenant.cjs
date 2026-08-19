/**
 * Seed roles, menus, and admin user inside a tenant schema.
 * Usage: node scripts/seed-tenant.cjs tenant_acme
 * Env: TENANT_SCHEMA, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */
const { PrismaClient } = require('@prisma/client');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');
const { databaseUrlForSchema } = require('./lib/database-url.cjs');
const { seedTenantAccess } = require('./lib/tenant-access-seed.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

const schema = (process.argv[2] || process.env.TENANT_SCHEMA || '').trim();
if (!schema || !/^tenant_[a-z0-9_]+$/.test(schema)) {
  console.error('Usage: node scripts/seed-tenant.cjs <tenant_schema>');
  console.error('Example: node scripts/seed-tenant.cjs tenant_acme');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrlForSchema(schema) } },
});

async function main() {
  const result = await seedTenantAccess(prisma, {
    adminEmail: process.env.SEED_ADMIN_EMAIL,
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    adminName: process.env.SEED_ADMIN_NAME,
  });

  console.log(`Tenant access seed completed for schema: ${schema}`);
  console.log(`Admin email: ${result.adminEmail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
