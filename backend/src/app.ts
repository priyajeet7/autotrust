import express from 'express';
import type { Express } from 'express';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ data: { status: 'ok' } });
  });

  return app;
}
