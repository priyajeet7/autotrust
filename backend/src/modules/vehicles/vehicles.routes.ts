import { Router } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError, parseOrThrow } from '../../http/errors.js';
import { requireAdmin } from '../auth/auth.middleware.js';
import {
  createVehicleSchema,
  searchVehiclesSchema,
  toVehicleResponse,
  updateVehicleSchema,
  vehicleIdSchema,
} from './vehicles.schemas.js';

const vehicleOrder = [
  { make: 'asc' },
  { model: 'asc' },
] satisfies Prisma.VehicleOrderByWithRelationInput[];

export const vehicleNotFound = () => new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');

/** Malformed ids are reported as "not found" rather than as a validation error. */
export function parseVehicleId(id: unknown): string {
  const result = vehicleIdSchema.safeParse(id);
  if (!result.success) throw vehicleNotFound();
  return result.data;
}

/** Drops undefined keys, which Prisma rejects under `exactOptionalPropertyTypes`. */
function definedOnly<T extends object>(input: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Mounted behind requireAuth. Deleting is admin-only. */
export function vehiclesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({ orderBy: vehicleOrder });
    res.json({ data: { vehicles: vehicles.map(toVehicleResponse) } });
  });

  router.get('/search', async (req, res) => {
    const { make, model, category, minPrice, maxPrice } = parseOrThrow(
      searchVehiclesSchema,
      req.query,
    );

    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(make ? { make: { contains: make, mode: 'insensitive' } } : {}),
        ...(model ? { model: { contains: model, mode: 'insensitive' } } : {}),
        ...(category ? { category } : {}),
        ...(minPrice !== undefined || maxPrice !== undefined
          ? {
              price: {
                ...(minPrice !== undefined ? { gte: minPrice } : {}),
                ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
              },
            }
          : {}),
      },
      orderBy: vehicleOrder,
    });
    res.json({ data: { vehicles: vehicles.map(toVehicleResponse) } });
  });

  router.post('/', async (req, res) => {
    const input = parseOrThrow(createVehicleSchema, req.body);
    const vehicle = await prisma.vehicle.create({ data: input });
    res.status(201).json({ data: { vehicle: toVehicleResponse(vehicle) } });
  });

  router.put('/:id', async (req, res) => {
    const id = parseVehicleId(req.params['id']);
    const input = parseOrThrow(updateVehicleSchema, req.body);

    try {
      const vehicle = await prisma.vehicle.update({ where: { id }, data: definedOnly(input) });
      res.json({ data: { vehicle: toVehicleResponse(vehicle) } });
    } catch (error) {
      if (isRecordNotFound(error)) throw vehicleNotFound();
      throw error;
    }
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const id = parseVehicleId(req.params['id']);

    try {
      await prisma.vehicle.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      if (isRecordNotFound(error)) throw vehicleNotFound();
      throw error;
    }
  });

  return router;
}
