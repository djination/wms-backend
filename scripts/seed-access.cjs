const { PrismaClient } = require('@prisma/client');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');
const { seedTenantAccess } = require('./lib/tenant-access-seed.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

const prisma = new PrismaClient();

async function main() {
  const result = await seedTenantAccess(prisma, {
    adminEmail: process.env.SEED_ADMIN_EMAIL,
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    adminName: process.env.SEED_ADMIN_NAME,
  });

  console.log('Access seed completed (public schema / legacy)');
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
