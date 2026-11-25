import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

export const buildInfo = Object.freeze({
  version: packageJson.version,
  gitCommit: process.env.GIT_COMMIT || 'unknown',
  buildTime: process.env.BUILD_TIME || 'unknown'
});
