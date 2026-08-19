/**
 * Migrate one tenant schema.
 * Usage: node scripts/flyway-migrate-tenant.cjs tenant_default
 */
const { spawnSync } = require('child_process');
const path = require('path');

const schema = process.argv[2]?.trim();
if (!schema) {
  console.error('Usage: node scripts/flyway-migrate-tenant.cjs <schema_name>');
  console.error('Example: node scripts/flyway-migrate-tenant.cjs tenant_default');
  process.exit(1);
}

if (!/^tenant_[a-z0-9_]+$/.test(schema)) {
  console.error(`Invalid tenant schema name: ${schema} (expected tenant_<slug>)`);
  process.exit(1);
}

const result = spawnSync(
  'node',
  [path.join(__dirname, 'flyway-run.cjs'), '--config=db/flyway-tenant.conf', `--schema=${schema}`],
  { stdio: 'inherit', cwd: path.resolve(__dirname, '..'), env: process.env },
);

process.exit(result.status ?? 1);
