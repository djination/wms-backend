/**
 * Regenerate db/migration/tenant/V1__baseline_wms.sql from prisma/migrations/*.
 * Run from backend/: node scripts/build-flyway-baseline.cjs
 */
const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
const outFile = path.resolve(__dirname, '../db/migration/tenant/V1__baseline_wms.sql');

const dirs = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const parts = [
  '-- WMS tenant schema baseline (consolidated from prisma/migrations)',
  '-- Regenerate: npm run flyway:baseline:build',
  '-- Target: per-tenant schema via Flyway (-defaultSchema=tenant_<slug>)',
  '',
];

for (const dir of dirs) {
  const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
  if (!fs.existsSync(sqlPath)) continue;
  parts.push(`-- === ${dir} ===`);
  parts.push(fs.readFileSync(sqlPath, 'utf8').trim());
  parts.push('');
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, parts.join('\n') + '\n', 'utf8');
console.log(`Wrote ${outFile} (${dirs.length} migration folders)`);
