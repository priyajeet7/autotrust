import { z } from 'zod';
import { VehicleCategory } from '../../generated/prisma/enums.js';
import type { Vehicle } from '../../generated/prisma/client.js';

const FIRST_CAR_YEAR = 1886;
const MAX_PRICE = 9_999_999_999.99; // Decimal(12, 2)
const categories = Object.values(VehicleCategory);

/** True when `value` has at most two decimal places (tolerant of binary floating point). */
function hasAtMostTwoDecimals(value: number): boolean {
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}

const text = z.string({ error: 'is required' }).trim().min(1, { error: 'is required' }).max(60);

export const vehicleIdSchema = z.uuid();

export const createVehicleSchema = z.object({
  make: text,
  model: text,
  year: z
    .number({ error: 'must be a number' })
    .int({ error: 'must be a whole number' })
    .min(FIRST_CAR_YEAR, { error: `must be ${String(FIRST_CAR_YEAR)} or later` })
    .refine((year) => year <= new Date().getFullYear() + 1, {
      error: 'cannot be more than one year in the future',
    }),
  category: z.enum(categories, { error: `must be one of: ${categories.join(', ')}` }),
  price: z
    .number({ error: 'must be a number' })
    .positive({ error: 'must be greater than 0' })
    .max(MAX_PRICE, { error: 'is too large' })
    .refine(hasAtMostTwoDecimals, { error: 'must have at most 2 decimal places' }),
  quantity: z
    .number({ error: 'must be a number' })
    .int({ error: 'must be a whole number' })
    .min(0, { error: 'cannot be negative' })
    .max(100_000)
    .default(0),
});

/** Stock is deliberately not editable here: only purchase and restock change `quantity`. */
export const updateVehicleSchema = createVehicleSchema
  .omit({ quantity: true })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    error: 'provide at least one field to update',
  });

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optionalPrice = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ error: 'must be a number' })
    .refine(Number.isFinite, { error: 'must be a number' })
    .min(0, { error: 'cannot be negative' })
    .optional(),
);

export const searchVehiclesSchema = z
  .object({
    make: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
    model: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
    category: z.preprocess(
      (value) => (typeof value === 'string' ? emptyToUndefined(value.toUpperCase()) : value),
      z.enum(categories, { error: `must be one of: ${categories.join(', ')}` }).optional(),
    ),
    minPrice: optionalPrice,
    maxPrice: optionalPrice,
  })
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    { error: 'must be greater than or equal to minPrice', path: ['maxPrice'] },
  );

/** API representation: Decimal price becomes a plain number. */
export function toVehicleResponse(vehicle: Vehicle) {
  return { ...vehicle, price: vehicle.price.toNumber() };
}
