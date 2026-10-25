import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Tests always run against the values in .env.test (never the developer's .env).
const testEnv = parse(readFileSync(new URL('./.env.test', import.meta.url)));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: testEnv,
    // Applies committed migrations to the *_test database (guarded) before any test runs.
    globalSetup: ['tests/setup/migrateTestDatabase.ts'],
    // Integration tests share one database; run files serially.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/generated/**'],
      reporter: ['text', 'html'],
    },
  },
});
