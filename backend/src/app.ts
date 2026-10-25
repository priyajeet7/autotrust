import express from 'express';
import type { Express } from 'express';
import type { PrismaClient } from './generated/prisma/client.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { requireAuth } from './modules/auth/auth.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { vehiclesRouter } from './modules/vehicles/vehicles.routes.js';

export interface AppDependencies {
  prisma: PrismaClient;
  jwtSecret: string;
}

/**
 * Builds the Express application without starting a server, so tests can drive it directly
 * with supertest. `server.ts` is the only place that calls `listen()`.
 */
export function createApp({ prisma, jwtSecret }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter(prisma, jwtSecret));
  app.use('/api/vehicles', requireAuth(prisma, jwtSecret), vehiclesRouter(prisma));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
