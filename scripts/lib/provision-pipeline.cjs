const { spawnSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('../apply-database-url.cjs');

const backendRoot = path.resolve(__dirname, '../..');
const platformClientPath = path.join(backendRoot, 'src/generated/platform-prisma');

function slugToSchema(slug) {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,30}$/.test(normalized)) {
    throw new Error(`Invalid tenant slug: ${slug}`);
  }
  return `tenant_${normalized.replace(/-/g, '_')}`;
}

function loadClients() {
  loadDotenv();
  applyDatabaseUrlToProcessEnv();
  const { PrismaClient: PlatformPrismaClient } = require(platformClientPath);
  return {
    platformDb: new PlatformPrismaClient(),
    tenantDb: new PrismaClient(),
  };
}

async function getDefaultPlanId(platformDb) {
  const starter = await platformDb.plan.findFirst({
    where: { code: 'STARTER', isActive: true },
  });
  if (starter) return starter.id;
  const any = await platformDb.plan.findFirst({ where: { isActive: true }, orderBy: { code: 'asc' } });
  return any?.id ?? null;
}

async function getTrialEndsAt(platformDb) {
  const setting = await platformDb.platformSetting.findUnique({ where: { key: 'default_trial_days' } });
  const days = Number(setting?.value?.days ?? 14);
  const ends = new Date();
  ends.setDate(ends.getDate() + days);
  return ends;
}

/**
 * @param {import('../../src/generated/platform-prisma').PrismaClient} platformDb
 */
async function createProvisioningTenant(platformDb, input) {
  const slug = input.slug.trim().toLowerCase();
  const schemaName = slugToSchema(slug);
  const existing = await platformDb.tenant.findFirst({
    where: { OR: [{ slug }, { schemaName }] },
  });
  if (existing && existing.status !== 'CANCELLED') {
    throw new Error(`Tenant already exists: ${slug}`);
  }

  const planId = input.planCode
    ? (await platformDb.plan.findUnique({ where: { code: input.planCode } }))?.id ?? null
    : await getDefaultPlanId(platformDb);

  const trialEndsAt = await getTrialEndsAt(platformDb);

  const tenant = await platformDb.tenant.create({
    data: {
      slug,
      schemaName,
      name: input.name.trim(),
      status: 'PROVISIONING',
      planId,
      trialEndsAt,
    },
  });

  if (planId) {
    await platformDb.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId,
        status: 'TRIAL',
        trialEndsAt,
      },
    });
  }

  return tenant;
}

async function createProvisioningJob(platformDb, tenantId, step) {
  return platformDb.tenantProvisioningJob.create({
    data: {
      tenantId,
      step,
      status: 'RUNNING',
      startedAt: new Date(),
      attemptCount: 1,
    },
  });
}

async function updateProvisioningJob(platformDb, jobId, patch) {
  return platformDb.tenantProvisioningJob.update({
    where: { id: jobId },
    data: patch,
  });
}

async function schemaExists(tenantDb, schemaName) {
  const rows = await tenantDb.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1 LIMIT 1`,
    schemaName,
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function flywayHistoryExists(tenantDb, schemaName) {
  const rows = await tenantDb.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = 'flyway_schema_history' LIMIT 1`,
    schemaName,
  );
  return Array.isArray(rows) && rows.length > 0;
}

function runFlywayMigrate(schemaName) {
  const result = spawnSync('node', [path.join(backendRoot, 'scripts/flyway-migrate-tenant.cjs'), schemaName], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Flyway migrate failed for schema ${schemaName}`);
  }
}

function runTenantSeed(schemaName, admin) {
  const env = {
    ...process.env,
    TENANT_SCHEMA: schemaName,
    SEED_ADMIN_EMAIL: admin.email,
    SEED_ADMIN_PASSWORD: admin.password,
    SEED_ADMIN_NAME: admin.name || 'Tenant Admin',
  };
  const result = spawnSync('node', [path.join(backendRoot, 'scripts/seed-tenant.cjs'), schemaName], {
    cwd: backendRoot,
    stdio: 'inherit',
    env,
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Tenant seed failed for schema ${schemaName}`);
  }
}

/**
 * Run full provisioning pipeline for an existing platform.tenants row.
 */
async function runProvisionPipeline(platformDb, tenantDb, tenantId, admin) {
  const tenant = await platformDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  let job = await createProvisioningJob(platformDb, tenantId, 'CREATE_SCHEMA');

  try {
    if (!(await schemaExists(tenantDb, tenant.schemaName))) {
      await tenantDb.$executeRawUnsafe(`CREATE SCHEMA "${tenant.schemaName}"`);
    }

    job = await updateProvisioningJob(platformDb, job.id, {
      step: 'MIGRATE',
      status: 'RUNNING',
    });

    if (!(await flywayHistoryExists(tenantDb, tenant.schemaName))) {
      runFlywayMigrate(tenant.schemaName);
    }

    job = await updateProvisioningJob(platformDb, job.id, {
      step: 'SEED',
      status: 'RUNNING',
    });

    runTenantSeed(tenant.schemaName, admin);

    await updateProvisioningJob(platformDb, job.id, {
      step: 'DONE',
      status: 'SUCCESS',
      finishedAt: new Date(),
      error: null,
    });

    await platformDb.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'TRIAL',
        provisionedAt: new Date(),
      },
    });

    return { tenantId, schemaName: tenant.schemaName, status: 'TRIAL' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateProvisioningJob(platformDb, job.id, {
      status: 'FAILED',
      error: message.slice(0, 4000),
      finishedAt: new Date(),
    });
    throw err;
  }
}

module.exports = {
  slugToSchema,
  loadClients,
  createProvisioningTenant,
  runProvisionPipeline,
};
