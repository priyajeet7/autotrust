import { createApp } from '../../src/app.js';
import { testJwtSecret, testPrisma } from './db.js';

/** The real application wired to the test database. */
export function buildTestApp() {
  return createApp({ prisma: testPrisma, jwtSecret: testJwtSecret });
}
