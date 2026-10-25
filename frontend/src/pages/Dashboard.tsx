import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SearchFilters, User, Vehicle, VehicleInput } from '../api/types';
import { SearchBar } from '../components/SearchBar';
import { VehicleCard } from '../components/VehicleCard';
import { VehicleForm } from '../components/VehicleForm';

interface DashboardProps {
  token: string;
  user: User;
  onLogout: () => void;
}

type Notice = { kind: 'success' | 'error'; text: string } | null;
type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; vehicle: Vehicle };

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong';

export function Dashboard({ token, user, onLogout }: DashboardProps) {
  const isAdmin = user.role === 'ADMIN';
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(
    async (filters?: SearchFilters) => {
      try {
        const { vehicles: result } = filters
          ? await api.searchVehicles(token, filters)
          : await api.listVehicles(token);
        setVehicles(result);
        setSearching(Boolean(filters));
      } catch (error) {
        setNotice({ kind: 'error', text: message(error) });
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (updated: Vehicle) =>
    setVehicles((current) => current?.map((v) => (v.id === updated.id ? updated : v)) ?? null);

  async function run(vehicleId: string, action: () => Promise<string>) {
    setBusyId(vehicleId);
    setNotice(null);
    try {
      setNotice({ kind: 'success', text: await action() });
    } catch (error) {
      setNotice({ kind: 'error', text: message(error) });
    } finally {
      setBusyId(null);
    }
  }

  const purchase = (vehicle: Vehicle) =>
    run(vehicle.id, async () => {
      const result = await api.purchaseVehicle(token, vehicle.id);
      replace(result.vehicle);
      return `Purchased ${vehicle.make} ${vehicle.model}. ${String(result.vehicle.quantity)} left in stock.`;
    });

  const restock = (vehicle: Vehicle, quantity: number) =>
    run(vehicle.id, async () => {
      const result = await api.restockVehicle(token, vehicle.id, quantity);
      replace(result.vehicle);
      return `Restocked ${vehicle.make} ${vehicle.model}: now ${String(result.vehicle.quantity)} in stock.`;
    });

  const remove = (vehicle: Vehicle) =>
    run(vehicle.id, async () => {
      await api.deleteVehicle(token, vehicle.id);
      setVehicles((current) => current?.filter((v) => v.id !== vehicle.id) ?? null);
      return `Deleted ${vehicle.make} ${vehicle.model}.`;
    });

  async function save(input: VehicleInput) {
    setFormError(null);
    try {
      if (form.mode === 'edit') {
        const { quantity: _stock, ...details } = input;
        const { vehicle } = await api.updateVehicle(token, form.vehicle.id, details);
        replace(vehicle);
        setNotice({ kind: 'success', text: `Updated ${vehicle.make} ${vehicle.model}.` });
      } else {
        const { vehicle } = await api.createVehicle(token, input);
        setVehicles((current) => [...(current ?? []), vehicle]);
        setNotice({ kind: 'success', text: `Added ${vehicle.make} ${vehicle.model}.` });
      }
      setForm({ mode: 'closed' });
    } catch (error) {
      setFormError(message(error));
    }
  }

  const inStock = vehicles?.reduce((sum, v) => sum + v.quantity, 0) ?? 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              AutoTrust Motors
            </p>
            <h1 className="text-xl font-bold text-slate-900">Inventory</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">
                {isAdmin ? (
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-semibold text-indigo-700">
                    Admin
                  </span>
                ) : (
                  user.email
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <SearchBar onSearch={(filters) => void load(filters)} onReset={() => void load()} />

        {notice && (
          <p
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-lg px-4 py-3 text-sm ${
              notice.kind === 'error'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {notice.text}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {vehicles === null
              ? 'Loading inventory…'
              : `Showing ${String(vehicles.length)} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}${
                  searching ? ' matching your search' : ''
                } · ${String(inStock)} units in stock`}
          </p>
          {isAdmin && form.mode === 'closed' && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setForm({ mode: 'create' });
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Add vehicle
            </button>
          )}
        </div>

        {isAdmin && form.mode !== 'closed' && (
          <VehicleForm
            key={form.mode === 'edit' ? form.vehicle.id : 'new'}
            {...(form.mode === 'edit' ? { vehicle: form.vehicle } : {})}
            error={formError}
            onSubmit={(input) => void save(input)}
            onCancel={() => setForm({ mode: 'closed' })}
          />
        )}

        {vehicles !== null && vehicles.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            {searching ? 'No vehicles match your search.' : 'No vehicles in inventory yet.'}
          </p>
        )}

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vehicles?.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              isAdmin={isAdmin}
              busy={busyId === vehicle.id}
              onPurchase={(v) => void purchase(v)}
              onRestock={(v, quantity) => void restock(v, quantity)}
              onDelete={(v) => void remove(v)}
              onEdit={(v) => {
                setFormError(null);
                setForm({ mode: 'edit', vehicle: v });
                window.scrollTo?.({ top: 0, behavior: 'smooth' });
              }}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
