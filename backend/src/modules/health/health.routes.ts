import { Router } from 'express';

/**
 * Liveness check. Deliberately does not touch the database: it answers "is the process up?",
 * so it stays cheap and cannot be slowed down or broken by a database outage.
 */
export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json({ data: { status: 'ok' } });
});
