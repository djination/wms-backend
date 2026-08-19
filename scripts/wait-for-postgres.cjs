/**
 * Block until PostgreSQL accepts connections (Docker / CI startup).
 */
const { PrismaClient } = require('@prisma/client');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

const maxAttempts = Number.parseInt(process.env.DB_WAIT_MAX_ATTEMPTS || '30', 10);
const delayMs = Number.parseInt(process.env.DB_WAIT_DELAY_MS || '2000', 10);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const prisma = new PrismaClient();
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('PostgreSQL is ready.');
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`Waiting for PostgreSQL (${attempt}/${maxAttempts})... ${message}`);
        if (attempt === maxAttempts) throw err;
        await sleep(delayMs);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
