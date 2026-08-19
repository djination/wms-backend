#!/bin/sh
set -e

cd /app

if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
  echo ">> Waiting for PostgreSQL..."
  node scripts/wait-for-postgres.cjs
fi

if [ "${SKIP_DB_MIGRATE:-false}" != "true" ]; then
  echo ">> Running Flyway (platform + tenants)..."
  export FLYWAY_RUNNER="${FLYWAY_RUNNER:-local}"
  npm run db:migrate
fi

echo ">> Starting API..."
exec "$@"
