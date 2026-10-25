import { createPrismaClient } from '../../src/lib/prisma.js';
import { assertTestDatabase } from '../../src/testing/assertTestDatabase.js';
import { hashPassword } from '../../src/modules/auth/password.js';
import { signToken } from '../../src/modules/auth/tokens.js';
import type { Prisma, Role } from '../../src/generated/prisma/client.js';

// Refuse to even connect unless this is a *_test database.
assertTestDatabase(process.env);

export const testPrisma = createPrismaClient(process.env['DATABASE_URL'] ?? '');
export const testJwtSecret = process.env['JWT_SECRET'] ?? '';

/** Empties every table. Guarded again so a misconfigured run can never wipe real data. */
export async function resetDatabase(): Promise<void> {
  assertTestDatabase(process.env);
  await testPrisma.$executeRawUnsafe(
    'TRUNCATE TABLE "purchases", "vehicles", "users" RESTART IDENTITY CASCADE',
  );
}

let userCounter = 0;

/** Inserts a user directly and returns it with a valid bearer token. */
export async function createUser(options: { role?: Role; password?: string } = {}) {
  userCounter += 1;
  const user = await testPrisma.user.create({
    data: {
      name: `Test User ${String(userCounter)}`,
      email: `user${String(userCounter)}-${String(Date.now())}@example.com`,
      passwordHash: await hashPassword(options.password ?? 'correct-horse-battery'),
      role: options.role ?? 'USER',
    },
  });
  const token = signToken({ sub: user.id, role: user.role }, testJwtSecret);
  return { user, token, authHeader: `Bearer ${token}` };
}

/** Inserts a vehicle directly (bypassing the API) for arranging test state. */
export function createVehicle(overrides: Partial<Prisma.VehicleCreateInput> = {}) {
  return testPrisma.vehicle.create({
    data: {
      make: 'Toyota',
      model: 'Corolla',
      year: 2024,
      category: 'SEDAN',
      price: '21500.00',
      quantity: 5,
      ...overrides,
    },
  });
}
