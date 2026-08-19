const { spawnSync } = require('child_process');
const path = require('path');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

const prismaArgs = process.argv.slice(2);

if (!process.env.DATABASE_URL?.trim()) {
  if (prismaArgs.includes('generate')) {
    process.env.DATABASE_URL = 'postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=platform';
  } else {
    console.error(
      'Missing DATABASE_URL. Set it in .env, or set PSQL_HOST, PSQL_NAME, PSQL_USER (and optional PSQL_PASSWORD, PSQL_PORT).',
    );
    process.exit(1);
  }
}
const result = spawnSync(
  'npx',
  ['prisma', ...prismaArgs, '--schema', 'prisma/schema-platform.prisma'],
  {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
  },
);

process.exit(result.status ?? 1);
