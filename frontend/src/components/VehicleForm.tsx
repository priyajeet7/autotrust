import { useState } from 'react';
import { CATEGORIES, categoryLabel } from '../api/types';
import type { Category, Vehicle, VehicleInput } from '../api/types';

interface VehicleFormProps {
  /** When given, the form edits this vehicle (stock is changed via restock, not here). */
  vehicle?: Vehicle;
  error?: string | null;
  saving?: boolean;
  onSubmit: (input: VehicleInput) => void;
  onCancel: () => void;
}

const field =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export function VehicleForm({
  vehicle,
  error,
  saving = false,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const [values, setValues] = useState({
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: String(vehicle?.year ?? new Date().getFullYear()),
    category: (vehicle?.category ?? 'SEDAN') as Category,
    price: vehicle ? String(vehicle.price) : '',
    quantity: '0',
  });
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      aria-label="Vehicle details"
      className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          make: values.make.trim(),
          model: values.model.trim(),
          year: Number(values.year),
          category: values.category,
          price: Number(values.price),
          quantity: Number(values.quantity),
        });
      }}
    >
      <h2 className="text-lg font-semibold">
        {vehicle ? `Edit ${vehicle.make} ${vehicle.model}` : 'Add a vehicle'}
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Make
          <input
            className={field}
            required
            value={values.make}
            onChange={(e) => set('make')(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Model
          <input
            className={field}
            required
            value={values.model}
            onChange={(e) => set('model')(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Year
          <input
            className={field}
            type="number"
            required
            min={1886}
            value={values.year}
            onChange={(e) => set('year')(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Category
          <select
            className={field}
            value={values.category}
            onChange={(e) => set('category')(e.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Price (USD)
          <input
            className={field}
            type="number"
            required
            min={0.01}
            step={0.01}
            value={values.price}
            onChange={(e) => set('price')(e.target.value)}
          />
        </label>
        {!vehicle && (
          <label className="text-sm font-medium text-slate-700">
            Initial stock
            <input
              className={field}
              type="number"
              required
              min={0}
              step={1}
              value={values.quantity}
              onChange={(e) => set('quantity')(e.target.value)}
            />
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          Save vehicle
        </button>
      </div>
    </form>
  );
}
