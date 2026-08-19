const path = require('path');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

function loadFlywayEnv() {
  loadDotenv();
  applyDatabaseUrlToProcessEnv();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      'Missing DATABASE_URL. Set it in backend/.env or PSQL_HOST/PSQL_NAME/PSQL_USER.',
    );
  }
  return databaseUrl;
}

function parsePostgresUrl(databaseUrl) {
  const base = databaseUrl.split('?')[0];
  const parsed = new URL(base.replace(/^postgresql:\/\//, 'http://'));
  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
  };
}

function toJdbcUrl(databaseUrl) {
  const { host, port, database } = parsePostgresUrl(databaseUrl);
  return `jdbc:postgresql://${host}:${port}/${database}`;
}

function flywayDockerHost(host) {
  if (process.env.FLYWAY_DOCKER_HOST?.trim()) {
    return process.env.FLYWAY_DOCKER_HOST.trim();
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'host.docker.internal';
  }
  return host;
}

module.exports = {
  backendRoot: path.resolve(__dirname, '..'),
  loadFlywayEnv,
  parsePostgresUrl,
  toJdbcUrl,
  flywayDockerHost,
};
