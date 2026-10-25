import { useState } from 'react';
import { categoryLabel } from '../api/types';
import type { Vehicle } from '../api/types';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

interface VehicleCardProps {
  vehicle: Vehicle;
  isAdmin: boolean;
  busy?: boolean;
  onPurchase: (vehicle: Vehicle) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
  onRestock: (vehicle: Vehicle, quantity: number) => void;
}

function stockStyle(quantity: number): string {
  if (quantity === 0) return 'bg-rose-100 text-rose-700';
  if (quantity <= 2) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-700';
}

export function VehicleCard({
  vehicle,
  isAdmin,
  busy = false,
  onPurchase,
  onEdit,
  onDelete,
  onRestock,
}: VehicleCardProps) {
  const [restockQuantity, setRestockQuantity] = useState('1');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const outOfStock = vehicle.quantity === 0;
  const restockAmount = Number(restockQuantity);
  const restockValid = Number.isInteger(restockAmount) && restockAmount >= 1;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {vehicle.make} {vehicle.model}
          </h3>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
            <span>{vehicle.year}</span>
            <span aria-hidden="true">·</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {categoryLabel(vehicle.category)}
            </span>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${stockStyle(vehicle.quantity)}`}
        >
          {vehicle.quantity} in stock
        </span>
      </div>

      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        {currency.format(vehicle.price)}
      </p>

      <button
        type="button"
        onClick={() => onPurchase(vehicle)}
        disabled={outOfStock || busy}
        className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
      >
        {outOfStock ? 'Out of stock' : 'Purchase'}
      </button>

      {isAdmin && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (restockValid) onRestock(vehicle, restockAmount);
            }}
          >
            <label className="sr-only" htmlFor={`restock-${vehicle.id}`}>
              Restock quantity
            </label>
            <input
              id={`restock-${vehicle.id}`}
              type="number"
              min={1}
              step={1}
              value={restockQuantity}
              onChange={(event) => setRestockQuantity(event.target.value)}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={!restockValid || busy}
              className="flex-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              Restock
            </button>
          </form>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(vehicle)}
              disabled={busy}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
            {confirmingDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => onDelete(vehicle)}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="flex-1 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
