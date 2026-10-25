/**
 * Idempotent demo seed: creates (or promotes) an admin account and, if the inventory is empty,
 * adds sample vehicles. Admin credentials come from the environment so none are hard-coded:
 *
 *   SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=... npm run db:seed
 */
import 'dotenv/config';
import { createPrismaClient } from '../src/lib/prisma.js';
import { hashPassword } from '../src/modules/auth/password.js';
import type { Prisma } from '../src/generated/prisma/client.js';

const { DATABASE_URL, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;

if (!DATABASE_URL || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 8) {
  console.error(
    'Set DATABASE_URL, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ characters) before seeding.',
  );
  process.exit(1);
}

const vehicles: Prisma.VehicleCreateManyInput[] = [
  { make: 'Toyota', model: 'Corolla', year: 2024, category: 'SEDAN', price: '21500', quantity: 6 },
  { make: 'Toyota', model: 'RAV4', year: 2025, category: 'SUV', price: '31000', quantity: 4 },
  { make: 'Honda', model: 'Civic', year: 2024, category: 'SEDAN', price: '24000', quantity: 3 },
  { make: 'Honda', model: 'CR-V', year: 2025, category: 'SUV', price: '32999.99', quantity: 0 },
  { make: 'Ford', model: 'F-150', year: 2023, category: 'TRUCK', price: '45000', quantity: 2 },
  { make: 'BMW', model: 'M4', year: 2024, category: 'COUPE', price: '78500', quantity: 1 },
  {
    make: 'Volkswagen',
    model: 'Golf',
    year: 2023,
    category: 'HATCHBACK',
    price: '23950',
    quantity: 5,
  },
  {
    make: 'Mazda',
    model: 'MX-5',
    year: 2024,
    category: 'CONVERTIBLE',
    price: '29990',
    quantity: 0,
  },
];

const prisma = createPrismaClient(DATABASE_URL);

try {
  const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
  await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: {
      name: 'Dealership Admin',
      email,
      passwordHash: await hashPassword(SEED_ADMIN_PASSWORD),
      role: 'ADMIN',
    },
  });
  console.log(`Admin ready: ${email}`);

  if ((await prisma.vehicle.count()) === 0) {
    const { count } = await prisma.vehicle.createMany({ data: vehicles });
    console.log(`Added ${String(count)} sample vehicles`);
  } else {
    console.log('Inventory not empty; sample vehicles skipped');
  }
} finally {
  await prisma.$disconnect();
}
