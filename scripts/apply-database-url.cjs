const path = require('path');

function loadDotenv() {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
}

/** Remove ?schema= so Prisma emits unqualified table names and PostgreSQL search_path can route tenant queries. */
function stripSchemaFromDatabaseUrl(url) {
  if (!url?.trim()) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('schema');
    return parsed.toString();
  } catch {
    return url.replace(/([?&])schema=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  }
}

function applyDatabaseUrlToProcessEnv() {
  const existing = process.env.DATABASE_URL?.trim();
  if (existing) {
    process.env.DATABASE_URL = stripSchemaFromDatabaseUrl(existing);
    return;
  }

  const host = process.env.PSQL_HOST;
  const name = process.env.PSQL_NAME;
  const user = process.env.PSQL_USER;
  if (!host || !name || user === undefined) return;

  const password = process.env.PSQL_PASSWORD ?? '';
  const port = process.env.PSQL_PORT || '5432';
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(name)}`;
}

module.exports = { loadDotenv, applyDatabaseUrlToProcessEnv, stripSchemaFromDatabaseUrl };
