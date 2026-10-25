import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaClient, Purchase } from '../../generated/prisma/client.js';
import { HttpError, parseOrThrow } from '../../http/errors.js';
import { getAuthUser, requireAdmin } from '../auth/auth.middleware.js';
import { parseVehicleId, vehicleNotFound } from '../vehicles/vehicles.routes.js';
import { toVehicleResponse } from '../vehicles/vehicles.schemas.js';

const wholeQuantity = (max: number) =>
  z
    .number({ error: 'must be a number' })
    .int({ error: 'must be a whole number' })
    .min(1, { error: 'must be at least 1' })
    .max(max, { error: `must be at most ${String(max)}` });

const purchaseSchema = z.object({ quantity: wholeQuantity(100).default(1) });
const restockSchema = z.object({ quantity: wholeQuantity(10_000) });

function toPurchaseResponse(purchase: Purchase) {
  return { ...purchase, unitPrice: purchase.unitPrice.toNumber() };
}

/** Purchase (any signed-in user) and restock (admin). Mounted behind requireAuth. */
export function inventoryRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/:id/purchase', async (req, res) => {
    const id = parseVehicleId(req.params['id']);
    const { quantity } = parseOrThrow(purchaseSchema, req.body ?? {});
    const buyer = getAuthUser(res);

    const { vehicle, purchase } = await prisma.$transaction(async (tx) => {
      // Decrement only if enough stock remains. Postgres locks the row and re-checks the
      // condition for concurrent buyers, so stock can never go below zero.
      const { count } = await tx.vehicle.updateMany({
        where: { id, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (count === 0) {
        const exists = await tx.vehicle.findUnique({ where: { id }, select: { id: true } });
        throw exists
          ? new HttpError(409, 'OUT_OF_STOCK', 'Not enough stock for this purchase')
          : vehicleNotFound();
      }

      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id } });
      const purchase = await tx.purchase.create({
        data: { userId: buyer.id, vehicleId: id, quantity, unitPrice: vehicle.price },
      });
      return { vehicle, purchase };
    });

    res.status(201).json({
      data: { purchase: toPurchaseResponse(purchase), vehicle: toVehicleResponse(vehicle) },
    });
  });

  router.post('/:id/restock', requireAdmin, async (req, res) => {
    const id = parseVehicleId(req.params['id']);
    const { quantity } = parseOrThrow(restockSchema, req.body ?? {});

    try {
      // A single atomic `quantity = quantity + n`, so concurrent restocks never lose updates.
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data: { quantity: { increment: quantity } },
      });
      res.json({ data: { vehicle: toVehicleResponse(vehicle) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw vehicleNotFound();
      }
      throw error;
    }
  });

  return router;
}
