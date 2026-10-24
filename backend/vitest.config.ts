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
    // Integration tests will share one database from M1 onward; run files serially.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', 'html'],
    },
  },
});
