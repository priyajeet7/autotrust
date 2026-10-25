import { describe, expect, it } from 'vitest';
import { mockApi } from '../test/mockApi';
import { ApiError, api } from './client';

describe('api client', () => {
  it('sends a JSON body with the bearer token and unwraps `data`', async () => {
    const calls = mockApi({
      'POST /api/vehicles/v-1/purchase': {
        status: 201,
        body: { data: { purchase: { id: 'p-1' }, vehicle: { id: 'v-1', quantity: 2 } } },
      },
    });

    const result = await api.purchaseVehicle('tok-123', 'v-1', 2);

    expect(result.vehicle.quantity).toBe(2);
    expect(calls[0]?.body).toEqual({ quantity: 2 });
    expect(calls[0]?.headers).toMatchObject({
      Authorization: 'Bearer tok-123',
      'Content-Type': 'application/json',
    });
  });

  it('throws an ApiError carrying the server message, code and status', async () => {
    mockApi({
      'POST /api/auth/login': {
        status: 401,
        body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      },
    });

    const error = await api.login('a@b.com', 'nope').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });

  it('includes the first field detail in validation error messages', async () => {
    mockApi({
      'POST /api/vehicles': {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [{ field: 'price', message: 'must be greater than 0' }],
          },
        },
      },
    });

    await expect(
      api.createVehicle('t', {
        make: 'A',
        model: 'B',
        year: 2024,
        category: 'SEDAN',
        price: 0,
        quantity: 1,
      }),
    ).rejects.toThrow('price must be greater than 0');
  });

  it('resolves to undefined for 204 No Content', async () => {
    mockApi({ 'DELETE /api/vehicles/v-1': { status: 204 } });

    await expect(api.deleteVehicle('t', 'v-1')).resolves.toBeUndefined();
  });

  it('builds the search query string from non-empty filters only', async () => {
    const calls = mockApi({
      'GET /api/vehicles/search': { status: 200, body: { data: { vehicles: [] } } },
    });

    await api.searchVehicles('t', {
      make: 'toy',
      model: '',
      category: 'SUV',
      minPrice: '',
      maxPrice: '40000',
    });

    expect(calls[0]?.url).toBe('/api/vehicles/search?make=toy&category=SUV&maxPrice=40000');
  });
});
