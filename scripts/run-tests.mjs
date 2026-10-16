import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const testDirectory = new URL('../tests/', import.meta.url);
const files = readdirSync(testDirectory)
  .filter((file) => file.endsWith('.test.ts'))
  .sort()
  .map((file) => join(testDirectory.pathname, file));

if (files.length === 0) {
  console.error('No tests/*.test.ts files were found.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--test', ...files],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('Could not start the Node.js test runner:', result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
