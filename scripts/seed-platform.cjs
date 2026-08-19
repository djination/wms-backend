/**
 * Seed platform schema: default plans + optional platform super admin.
 * Prerequisite: npm run flyway:platform
 */
const bcrypt = require('bcrypt');
const path = require('path');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

const { PrismaClient, PlatformRole } = require(path.join(
  __dirname,
  '../src/generated/platform-prisma',
));

const prisma = new PrismaClient();

const PLATFORM_ADMIN_EMAIL = (process.env.SEED_PLATFORM_ADMIN_EMAIL || 'platform@wms.local').toLowerCase();
const PLATFORM_ADMIN_PASSWORD = process.env.SEED_PLATFORM_ADMIN_PASSWORD || 'password123';
const PLATFORM_ADMIN_NAME = process.env.SEED_PLATFORM_ADMIN_NAME || 'Platform Super Admin';

const DEFAULT_PLANS = [
  {
    code: 'STARTER',
    name: 'Starter',
    sortOrder: 1,
    maxWarehouses: 1,
    maxUsers: 5,
    maxCustomers: 10,
    priceMonthly: 0,
    features: { transitImport: false, processFlow: true },
  },
  {
    code: 'PRO',
    name: 'Professional',
    sortOrder: 2,
    maxWarehouses: 5,
    maxUsers: 25,
    maxCustomers: 50,
    priceMonthly: 1990000,
    features: { transitImport: true, processFlow: true },
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    sortOrder: 3,
    maxWarehouses: 99,
    maxUsers: 999,
    maxCustomers: 999,
    priceMonthly: 0,
    features: { transitImport: true, processFlow: true, customDomain: true },
  },
];

async function upsertPlan(plan) {
  return prisma.plan.upsert({
    where: { code: plan.code },
    update: {
      name: plan.name,
      sortOrder: plan.sortOrder,
      maxWarehouses: plan.maxWarehouses,
      maxUsers: plan.maxUsers,
      maxCustomers: plan.maxCustomers,
      priceMonthly: plan.priceMonthly,
      features: plan.features,
      isActive: true,
    },
    create: {
      code: plan.code,
      name: plan.name,
      sortOrder: plan.sortOrder,
      maxWarehouses: plan.maxWarehouses,
      maxUsers: plan.maxUsers,
      maxCustomers: plan.maxCustomers,
      priceMonthly: plan.priceMonthly,
      features: plan.features,
      isActive: true,
    },
  });
}

async function main() {
  for (const plan of DEFAULT_PLANS) {
    const row = await upsertPlan(plan);
    console.log(`Plan: ${row.code} (${row.id})`);
  }

  const passwordHash = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 10);
  const admin = await prisma.platformUser.upsert({
    where: { email: PLATFORM_ADMIN_EMAIL },
    update: {
      passwordHash,
      name: PLATFORM_ADMIN_NAME,
      role: PlatformRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: PLATFORM_ADMIN_EMAIL,
      passwordHash,
      name: PLATFORM_ADMIN_NAME,
      role: PlatformRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`Platform admin: ${admin.email} (${admin.role})`);

  await prisma.platformSetting.upsert({
    where: { key: 'default_trial_days' },
    update: { value: { days: 14 } },
    create: { key: 'default_trial_days', value: { days: 14 } },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'signup_enabled' },
    update: { value: { enabled: true } },
    create: { key: 'signup_enabled', value: { enabled: true } },
  });
  await prisma.platformSetting.upsert({
    where: { key: 'maintenance_mode' },
    update: { value: { enabled: false, message: '' } },
    create: { key: 'maintenance_mode', value: { enabled: false, message: '' } },
  });
  console.log('Platform settings: default_trial_days, signup_enabled, maintenance_mode');

  const devSchema = process.env.FLYWAY_DEV_TENANT_SCHEMA?.trim();
  if (devSchema) {
    const starter = await prisma.plan.findUnique({ where: { code: 'STARTER' } });
    const slug = process.env.SEED_DEV_TENANT_SLUG?.trim() || 'default';
    const tenant = await prisma.tenant.upsert({
      where: { slug },
      update: {
        schemaName: devSchema,
        name: process.env.SEED_DEV_TENANT_NAME?.trim() || 'Default Dev Tenant',
        status: 'ACTIVE',
        planId: starter?.id ?? null,
        provisionedAt: new Date(),
      },
      create: {
        slug,
        schemaName: devSchema,
        name: process.env.SEED_DEV_TENANT_NAME?.trim() || 'Default Dev Tenant',
        status: 'ACTIVE',
        planId: starter?.id ?? null,
        provisionedAt: new Date(),
      },
    });
    console.log(`Dev tenant registry: ${tenant.slug} -> ${tenant.schemaName} (${tenant.status})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
