const path = require('path');

function loadDotenv() {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
}

function applyDatabaseUrlToProcessEnv() {
  const existing = process.env.DATABASE_URL?.trim();
  if (existing) return;

  const host = process.env.PSQL_HOST;
  const name = process.env.PSQL_NAME;
  const user = process.env.PSQL_USER;
  if (!host || !name || user === undefined) return;

  const password = process.env.PSQL_PASSWORD ?? '';
  const port = process.env.PSQL_PORT || '5432';
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(name)}?schema=public`;
}

module.exports = { loadDotenv, applyDatabaseUrlToProcessEnv };
