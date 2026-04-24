import { createRequire } from 'module';
import { join } from 'path';

const cjsRequire = createRequire(__filename);
const { loadDotenv, applyDatabaseUrlToProcessEnv } = cjsRequire(
  join(__dirname, '..', '..', 'scripts', 'apply-database-url.cjs'),
) as {
  loadDotenv: () => void;
  applyDatabaseUrlToProcessEnv: () => void;
};

loadDotenv();
applyDatabaseUrlToProcessEnv();
