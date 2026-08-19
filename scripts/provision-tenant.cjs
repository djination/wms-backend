/**
 * CLI: register tenant in platform + run provisioning pipeline.
 *
 * Usage:
 *   node scripts/provision-tenant.cjs --slug=acme --name="PT Acme" --admin-email=admin@acme.com --admin-password=secret
 */
const {
  loadClients,
  createProvisioningTenant,
  runProvisionPipeline,
} = require('./lib/provision-pipeline.cjs');

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) continue;
    out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug?.trim();
  const name = args.name?.trim();
  const adminEmail = args['admin-email']?.trim();
  const adminPassword = args['admin-password'];
  const adminName = args['admin-name']?.trim();
  const planCode = args['plan-code']?.trim();

  if (!slug || !name || !adminEmail || !adminPassword) {
    console.error(
      'Usage: node scripts/provision-tenant.cjs --slug=acme --name="PT Acme" --admin-email=admin@acme.com --admin-password=secret [--admin-name=Admin] [--plan-code=STARTER]',
    );
    process.exit(1);
  }

  const { platformDb, tenantDb } = loadClients();

  try {
    const tenant = await createProvisioningTenant(platformDb, {
      slug,
      name,
      planCode,
      adminEmail,
      adminPassword,
      adminName,
    });
    console.log(`Tenant registered: ${tenant.slug} -> ${tenant.schemaName} (${tenant.status})`);

    const result = await runProvisionPipeline(platformDb, tenantDb, tenant.id, {
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      name: adminName,
    });

    console.log('Provisioning completed:', result);
  } finally {
    await platformDb.$disconnect();
    await tenantDb.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
