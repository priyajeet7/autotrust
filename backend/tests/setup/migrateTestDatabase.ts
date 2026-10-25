/**
 * Vitest global setup: brings the test database schema up to date before any test file runs.
 *
 * Runs `prisma migrate deploy` (applies committed migrations only, never generates or resets) and
 * only after assertTestDatabase() has confirmed the target is a *_test database.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { assertTestDatabase } from '../../src/testing/assertTestDatabase.js';

const backendRoot = fileURLToPath(new URL('../..', import.meta.url));
// Invoke the CLI through the current Node binary: `npx` cannot be spawned without a shell on Windows.
const prismaCli = fileURLToPath(
  new URL('../../node_modules/prisma/build/index.js', import.meta.url),
);

export default function setup(): void {
  const testEnv = parse(readFileSync(new URL('../../.env.test', import.meta.url)));
  const env = { ...process.env, ...testEnv };

  assertTestDatabase(env);

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: backendRoot,
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
