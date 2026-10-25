import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { createUser, createVehicle, resetDatabase, testPrisma } from '../helpers/db.js';

const app = buildTestApp();

const newVehicle = {
  make: 'Honda',
  model: 'CR-V',
  year: 2025,
  category: 'SUV',
  price: 32999.99,
  quantity: 4,
};

let userAuth: string;
let adminAuth: string;

beforeEach(async () => {
  await resetDatabase();
  userAuth = (await createUser()).authHeader;
  adminAuth = (await createUser({ role: 'ADMIN' })).authHeader;
});
afterAll(() => testPrisma.$disconnect());

describe('authentication on /api/vehicles', () => {
  it.each([
    ['get', '/api/vehicles'],
    ['get', '/api/vehicles/search?make=Honda'],
    ['post', '/api/vehicles'],
    ['put', `/api/vehicles/${randomUUID()}`],
    ['delete', `/api/vehicles/${randomUUID()}`],
  ] as const)('%s %s responds 401 without a token', async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
  });
});

describe('POST /api/vehicles', () => {
  it('creates a vehicle and returns it with a numeric price', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', userAuth)
      .send(newVehicle);

    expect(response.status).toBe(201);
    expect(response.body.data.vehicle).toEqual({
      id: expect.any(String),
      ...newVehicle,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(await testPrisma.vehicle.count()).toBe(1);
  });

  it('trims text fields and defaults quantity to 0', async () => {
    const withoutQuantity = { ...newVehicle, quantity: undefined };

    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', userAuth)
      .send({ ...withoutQuantity, make: '  Honda ', model: ' CR-V  ' });

    expect(response.status).toBe(201);
    expect(response.body.data.vehicle).toMatchObject({ make: 'Honda', model: 'CR-V', quantity: 0 });
  });

  it.each([
    ['missing make', { make: '' }, 'make'],
    ['missing model', { model: '   ' }, 'model'],
    ['unknown category', { category: 'SPACESHIP' }, 'category'],
    ['negative price', { price: -1 }, 'price'],
    ['zero price', { price: 0 }, 'price'],
    ['price with more than 2 decimals', { price: 100.123 }, 'price'],
    ['price given as a string', { price: '100' }, 'price'],
    ['year before cars existed', { year: 1800 }, 'year'],
    ['year far in the future', { year: new Date().getFullYear() + 5 }, 'year'],
    ['fractional quantity', { quantity: 1.5 }, 'quantity'],
    ['negative quantity', { quantity: -2 }, 'quantity'],
  ])('responds 400 for %s', async (_label, override, field) => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', userAuth)
      .send({ ...newVehicle, ...override });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(await testPrisma.vehicle.count()).toBe(0);
  });
});

describe('GET /api/vehicles', () => {
  it('lists every vehicle ordered by make then model', async () => {
    await createVehicle({ make: 'Toyota', model: 'RAV4' });
    await createVehicle({ make: 'BMW', model: 'X5' });
    await createVehicle({ make: 'Toyota', model: 'Camry' });

    const response = await request(app).get('/api/vehicles').set('Authorization', userAuth);

    expect(response.status).toBe(200);
    expect(
      response.body.data.vehicles.map(
        (v: { make: string; model: string }) => `${v.make} ${v.model}`,
      ),
    ).toEqual(['BMW X5', 'Toyota Camry', 'Toyota RAV4']);
  });

  it('returns an empty list when there is no inventory', async () => {
    const response = await request(app).get('/api/vehicles').set('Authorization', userAuth);

    expect(response.body).toEqual({ data: { vehicles: [] } });
  });
});

describe('GET /api/vehicles/search', () => {
  beforeEach(async () => {
    await createVehicle({ make: 'Toyota', model: 'Corolla', category: 'SEDAN', price: '21500' });
    await createVehicle({ make: 'Toyota', model: 'RAV4', category: 'SUV', price: '31000' });
    await createVehicle({ make: 'Ford', model: 'F-150', category: 'TRUCK', price: '45000' });
    await createVehicle({ make: 'Honda', model: 'Civic', category: 'SEDAN', price: '24000' });
  });

  async function search(query: string): Promise<string[]> {
    const response = await request(app)
      .get(`/api/vehicles/search?${query}`)
      .set('Authorization', userAuth);
    expect(response.status).toBe(200);
    return response.body.data.vehicles.map((v: { model: string }) => v.model);
  }

  it('matches make case-insensitively and partially', async () => {
    expect(await search('make=toy')).toEqual(['Corolla', 'RAV4']);
  });

  it('matches model case-insensitively and partially', async () => {
    expect(await search('model=f-1')).toEqual(['F-150']);
  });

  it('filters by category (case-insensitive)', async () => {
    expect(await search('category=sedan')).toEqual(['Civic', 'Corolla']);
  });

  it('filters by an inclusive price range', async () => {
    expect(await search('minPrice=21500&maxPrice=31000')).toEqual(['Civic', 'Corolla', 'RAV4']);
    expect(await search('minPrice=40000')).toEqual(['F-150']);
    expect(await search('maxPrice=22000')).toEqual(['Corolla']);
  });

  it('combines filters with AND', async () => {
    expect(await search('make=toyota&category=SUV&maxPrice=35000')).toEqual(['RAV4']);
  });

  it('returns everything when no filters are given, and nothing when none match', async () => {
    expect(await search('')).toHaveLength(4);
    expect(await search('make=Ferrari')).toEqual([]);
  });

  it.each([
    ['a non-numeric price', 'minPrice=cheap'],
    ['minPrice above maxPrice', 'minPrice=50000&maxPrice=10000'],
    ['an unknown category', 'category=SPACESHIP'],
  ])('responds 400 for %s', async (_label, query) => {
    const response = await request(app)
      .get(`/api/vehicles/search?${query}`)
      .set('Authorization', userAuth);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/vehicles/:id', () => {
  it('updates the given fields and leaves the rest unchanged', async () => {
    const vehicle = await createVehicle({ price: '21500', quantity: 5 });

    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .set('Authorization', userAuth)
      .send({ price: 19999.5, model: 'Corolla Hybrid' });

    expect(response.status).toBe(200);
    expect(response.body.data.vehicle).toMatchObject({
      id: vehicle.id,
      make: 'Toyota',
      model: 'Corolla Hybrid',
      price: 19999.5,
      quantity: 5,
    });
    const stored = await testPrisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(stored.price.toString()).toBe('19999.5');
  });

  it('refuses to change quantity, which only purchase and restock may do', async () => {
    const vehicle = await createVehicle({ quantity: 5 });

    const response = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .set('Authorization', userAuth)
      .send({ quantity: 500 });

    expect(response.status).toBe(400);
    const stored = await testPrisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(stored.quantity).toBe(5);
  });

  it('responds 400 for an empty update or invalid values', async () => {
    const vehicle = await createVehicle();

    const empty = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .set('Authorization', userAuth)
      .send({});
    const invalid = await request(app)
      .put(`/api/vehicles/${vehicle.id}`)
      .set('Authorization', userAuth)
      .send({ price: -5 });

    expect(empty.status).toBe(400);
    expect(invalid.status).toBe(400);
  });

  it.each([
    ['an unknown id', randomUUID()],
    ['a malformed id', 'not-a-uuid'],
  ])('responds 404 for %s', async (_label, id) => {
    const response = await request(app)
      .put(`/api/vehicles/${id}`)
      .set('Authorization', userAuth)
      .send({ price: 100 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('VEHICLE_NOT_FOUND');
  });
});

describe('DELETE /api/vehicles/:id', () => {
  it('lets an admin delete a vehicle (204)', async () => {
    const vehicle = await createVehicle();

    const response = await request(app)
      .delete(`/api/vehicles/${vehicle.id}`)
      .set('Authorization', adminAuth);

    expect(response.status).toBe(204);
    expect(await testPrisma.vehicle.count()).toBe(0);
  });

  it('forbids a regular user (403) and keeps the vehicle', async () => {
    const vehicle = await createVehicle();

    const response = await request(app)
      .delete(`/api/vehicles/${vehicle.id}`)
      .set('Authorization', userAuth);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(await testPrisma.vehicle.count()).toBe(1);
  });

  it('keeps purchase history when a sold vehicle is deleted', async () => {
    const vehicle = await createVehicle();
    const { user } = await createUser();
    await testPrisma.purchase.create({
      data: { userId: user.id, vehicleId: vehicle.id, quantity: 1, unitPrice: vehicle.price },
    });

    const response = await request(app)
      .delete(`/api/vehicles/${vehicle.id}`)
      .set('Authorization', adminAuth);

    expect(response.status).toBe(204);
    const purchase = await testPrisma.purchase.findFirstOrThrow();
    expect(purchase.vehicleId).toBeNull();
  });

  it('responds 404 for an unknown vehicle', async () => {
    const response = await request(app)
      .delete(`/api/vehicles/${randomUUID()}`)
      .set('Authorization', adminAuth);

    expect(response.status).toBe(404);
  });
});
