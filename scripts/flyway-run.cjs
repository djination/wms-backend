/**
 * Run Flyway migrate with backend/.env database credentials.
 *
 * Usage:
 *   node scripts/flyway-run.cjs --config=db/flyway-platform.conf
 *   node scripts/flyway-run.cjs --config=db/flyway-tenant.conf --schema=tenant_default
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  backendRoot,
  loadFlywayEnv,
  parsePostgresUrl,
  toJdbcUrl,
  flywayDockerHost,
} = require('./flyway-env.cjs');

function parseArgs(argv) {
  const args = { config: 'db/flyway-platform.conf', schema: null, schemas: null };
  for (const arg of argv) {
    if (arg.startsWith('--config=')) args.config = arg.slice('--config='.length);
    else if (arg.startsWith('--schema=')) args.schema = arg.slice('--schema='.length);
    else if (arg.startsWith('--schemas=')) args.schemas = arg.slice('--schemas='.length);
  }
  return args;
}

function readConfProperties(configPath) {
  const abs = path.resolve(backendRoot, configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Flyway config not found: ${abs}`);
  }
  const props = {};
  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    props[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return { abs, props };
}

function mergeFlywayProps(baseProps, overlayProps, cli) {
  const merged = { ...baseProps, ...overlayProps };
  if (cli.schema) {
    merged['flyway.schemas'] = cli.schema;
    merged['flyway.defaultSchema'] = cli.schema;
  }
  if (cli.schemas) {
    merged['flyway.schemas'] = cli.schemas;
    const first = cli.schemas.split(',')[0]?.trim();
    if (first) merged['flyway.defaultSchema'] = first;
  }
  return merged;
}

function flywayPropToCliFlag(key) {
  const k = key.startsWith('flyway.') ? key.slice('flyway.'.length) : key;
  return k;
}

function buildFlywayCliArgs(mergedProps) {
  const args = [];
  for (const [key, value] of Object.entries(mergedProps)) {
    if (!value) continue;
    args.push(`-${flywayPropToCliFlag(key)}=${value}`);
  }
  args.push('migrate');
  return args;
}

function flywaySpawnEnv(jdbcUrl, pg) {
  return {
    ...process.env,
    FLYWAY_URL: jdbcUrl,
    FLYWAY_USER: pg.user,
    FLYWAY_PASSWORD: pg.password,
  };
}

function runLocalFlyway(flywayArgs, jdbcUrl, pg) {
  return spawnSync('flyway', flywayArgs, {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: true,
    env: flywaySpawnEnv(jdbcUrl, pg),
  });
}

function runDockerFlyway(flywayArgs, jdbcUrl, pg) {
  const dockerHost = flywayDockerHost(pg.host);
  const jdbcForDocker = jdbcUrl.replace(/\/\/([^:/]+)/, `//${dockerHost}`);

  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${backendRoot}:/flyway/project`,
    '-w',
    '/flyway/project',
    '-e',
    `FLYWAY_URL=${jdbcForDocker}`,
    '-e',
    `FLYWAY_USER=${pg.user}`,
    '-e',
    `FLYWAY_PASSWORD=${pg.password}`,
  ];

  if (process.env.FLYWAY_DOCKER_NETWORK?.trim()) {
    dockerArgs.push('--network', process.env.FLYWAY_DOCKER_NETWORK.trim());
  }

  dockerArgs.push('flyway/flyway:11', ...flywayArgs);

  return spawnSync('docker', dockerArgs, {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const databaseUrl = loadFlywayEnv();
  const pg = parsePostgresUrl(databaseUrl);
  const jdbcUrl = toJdbcUrl(databaseUrl);

  const baseConf = path.resolve(backendRoot, 'db/flyway.conf');
  const baseProps = fs.existsSync(baseConf) ? readConfProperties('db/flyway.conf').props : {};
  const { props: overlayProps } = readConfProperties(cli.config);
  const merged = mergeFlywayProps(baseProps, overlayProps, cli);

  const flywayArgs = buildFlywayCliArgs(merged);

  const mode = (process.env.FLYWAY_RUNNER || 'auto').toLowerCase();
  let result;

  if (mode === 'docker') {
    result = runDockerFlyway(flywayArgs, jdbcUrl, pg);
  } else if (mode === 'local') {
    result = runLocalFlyway(flywayArgs, jdbcUrl, pg);
  } else {
    const localCheck = spawnSync('flyway', ['-v'], { shell: true, encoding: 'utf8' });
    result =
      localCheck.status === 0
        ? runLocalFlyway(flywayArgs, jdbcUrl, pg)
        : runDockerFlyway(flywayArgs, jdbcUrl, pg);
  }

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

main();
