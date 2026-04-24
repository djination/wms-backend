const { spawnSync } = require('child_process');
const path = require('path');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    'Missing DATABASE_URL. Set it in .env, or set PSQL_HOST, PSQL_NAME, PSQL_USER (and optional PSQL_PASSWORD, PSQL_PORT).',
  );
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);
const result = spawnSync('npx', ['prisma', ...prismaArgs], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
});

process.exit(result.status ?? 1);
