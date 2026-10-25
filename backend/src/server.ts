/**
 * Process entrypoint: load .env, validate configuration, start listening.
 * Kept free of logic so everything testable lives in createApp() and parseEnv().
 */
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { EnvValidationError, parseEnv } from './config/env.js';
import type { Env } from './config/env.js';
import { createPrismaClient } from './lib/prisma.js';

dotenv.config({ quiet: true });

function loadConfig(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const env = loadConfig();
const prisma = createPrismaClient(env.DATABASE_URL);
const server = createApp({ prisma, jwtSecret: env.JWT_SECRET }).listen(env.PORT, () => {
  console.log(`AutoTrust API listening on port ${String(env.PORT)} (${env.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, closing server`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
