const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(
  'node',
  [path.join(__dirname, 'flyway-run.cjs'), '--config=db/flyway-platform.conf'],
  { stdio: 'inherit', cwd: path.resolve(__dirname, '..'), env: process.env },
);

process.exit(result.status ?? 1);
