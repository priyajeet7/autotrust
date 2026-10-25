import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { createUser, createVehicle, resetDatabase, testPrisma } from '../helpers/db.js';

const app = buildTestApp();

let buyer: Awaited<ReturnType<typeof createUser>>;
let adminAuth: string;

beforeEach(async () => {
  await resetDatabase();
  buyer = await createUser();
  adminAuth = (await createUser({ role: 'ADMIN' })).authHeader;
});
afterAll(() => testPrisma.$disconnect());

async function stockOf(id: string): Promise<number> {
  return (await testPrisma.vehicle.findUniqueOrThrow({ where: { id } })).quantity;
}

describe('POST /api/vehicles/:id/purchase', () => {
  it('sells one unit by default, decrements stock and records the sale', async () => {
    const vehicle = await createVehicle({ quantity: 3, price: '25000.50' });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authHeader);

    expect(response.status).toBe(201);
    expect(response.body.data.vehicle).toMatchObject({ id: vehicle.id, quantity: 2 });
    expect(response.body.data.purchase).toEqual({
      id: expect.any(String),
      vehicleId: vehicle.id,
      userId: buyer.user.id,
      quantity: 1,
      unitPrice: 25000.5,
      createdAt: expect.any(String),
    });
    expect(await stockOf(vehicle.id)).toBe(2);
    expect(await testPrisma.purchase.count({ where: { userId: buyer.user.id } })).toBe(1);
  });

  it('sells several units at once', async () => {
    const vehicle = await createVehicle({ quantity: 5 });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authHeader)
      .send({ quantity: 3 });

    expect(response.status).toBe(201);
    expect(await stockOf(vehicle.id)).toBe(2);
  });

  it('can sell the last unit, reaching exactly zero', async () => {
    const vehicle = await createVehicle({ quantity: 2 });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authHeader)
      .send({ quantity: 2 });

    expect(response.status).toBe(201);
    expect(await stockOf(vehicle.id)).toBe(0);
  });

  it('responds 409 OUT_OF_STOCK and changes nothing when stock is insufficient', async () => {
    const vehicle = await createVehicle({ quantity: 1 });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authHeader)
      .send({ quantity: 2 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('OUT_OF_STOCK');
    expect(await stockOf(vehicle.id)).toBe(1);
    expect(await testPrisma.purchase.count()).toBe(0);
  });

  it('responds 409 for a vehicle with zero stock', async () => {
    const vehicle = await createVehicle({ quantity: 0 });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authHeader);

    expect(response.status).toBe(409);
    expect(await stockOf(vehicle.id)).toBe(0);
  });

  it('never oversells under concurrent purchases', async () => {
    const vehicle = await createVehicle({ quantity: 3 });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post(`/api/vehicles/${vehicle.id}/purchase`)
          .set('Authorization', buyer.authHeader),
      ),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 409)).toHaveLength(7);
    expect(await stockOf(vehicle.id)).toBe(0);
    expect(await testPrisma.purchase.count()).toBe(3);
  });

  it.each([0, -1, 1.5, '2'])('responds 400 for quantity %j', async (quantity) => {
    const vehicle = await createVehicle({ quantity: 5 });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', buyer.authHeader)
      .send({ quantity });

    expect(response.status).toBe(400);
    expect(await stockOf(vehicle.id)).toBe(5);
  });

  it('responds 404 for an unknown vehicle', async () => {
    const response = await request(app)
      .post(`/api/vehicles/${randomUUID()}/purchase`)
      .set('Authorization', buyer.authHeader);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('VEHICLE_NOT_FOUND');
  });

  it('responds 401 without a token', async () => {
    const vehicle = await createVehicle();

    const response = await request(app).post(`/api/vehicles/${vehicle.id}/purchase`);

    expect(response.status).toBe(401);
    expect(await stockOf(vehicle.id)).toBe(5);
  });
});

describe('POST /api/vehicles/:id/restock', () => {
  it('lets an admin add stock', async () => {
    const vehicle = await createVehicle({ quantity: 0 });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/restock`)
      .set('Authorization', adminAuth)
      .send({ quantity: 7 });

    expect(response.status).toBe(200);
    expect(response.body.data.vehicle).toMatchObject({ id: vehicle.id, quantity: 7 });
    expect(await stockOf(vehicle.id)).toBe(7);
  });

  it('applies concurrent restocks without losing updates', async () => {
    const vehicle = await createVehicle({ quantity: 1 });

    await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post(`/api/vehicles/${vehicle.id}/restock`)
          .set('Authorization', adminAuth)
          .send({ quantity: 2 }),
      ),
    );

    expect(await stockOf(vehicle.id)).toBe(11);
  });

  it('forbids a regular user (403) and leaves stock unchanged', async () => {
    const vehicle = await createVehicle({ quantity: 2 });

    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/restock`)
      .set('Authorization', buyer.authHeader)
      .send({ quantity: 5 });

    expect(response.status).toBe(403);
    expect(await stockOf(vehicle.id)).toBe(2);
  });

  it.each([undefined, 0, -3, 2.5, 'ten', 10_001])(
    'responds 400 for quantity %j',
    async (quantity) => {
      const vehicle = await createVehicle({ quantity: 2 });

      const response = await request(app)
        .post(`/api/vehicles/${vehicle.id}/restock`)
        .set('Authorization', adminAuth)
        .send({ quantity });

      expect(response.status).toBe(400);
      expect(await stockOf(vehicle.id)).toBe(2);
    },
  );

  it('responds 404 for an unknown vehicle', async () => {
    const response = await request(app)
      .post(`/api/vehicles/${randomUUID()}/restock`)
      .set('Authorization', adminAuth)
      .send({ quantity: 1 });

    expect(response.status).toBe(404);
  });
});
