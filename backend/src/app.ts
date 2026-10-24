import express from 'express';
import type { Express } from 'express';
import { healthRouter } from './modules/health/health.routes.js';

/**
 * Builds the Express application without starting a server, so tests can drive it directly
 * with supertest. `server.ts` is the only place that calls `listen()`.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use('/api/health', healthRouter);

  return app;
}
