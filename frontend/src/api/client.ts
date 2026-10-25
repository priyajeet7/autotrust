import type { SearchFilters, Session, User, Vehicle, VehicleInput } from './types';

/** A non-2xx API response, carrying the server's `{ error: { code, message } }`. */
export class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: { field: string; message: string }[] };
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => ({}))) as { data?: T } & ErrorBody;
  if (!response.ok) {
    const detail = payload.error?.details?.[0];
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'UNKNOWN',
      detail
        ? `${detail.field} ${detail.message}`
        : (payload.error?.message ?? `Request failed (${String(response.status)})`),
    );
  }
  return payload.data as T;
}

function searchQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim() !== '') params.set(key, value.trim());
  }
  return params.toString();
}

export const api = {
  login: (email: string, password: string) =>
    request<Session>('/api/auth/login', { method: 'POST', body: { email, password } }),

  register: (name: string, email: string, password: string) =>
    request<Session>('/api/auth/register', { method: 'POST', body: { name, email, password } }),

  me: (token: string) => request<{ user: User }>('/api/auth/me', { token }),

  listVehicles: (token: string) => request<{ vehicles: Vehicle[] }>('/api/vehicles', { token }),

  searchVehicles: (token: string, filters: SearchFilters) =>
    request<{ vehicles: Vehicle[] }>(`/api/vehicles/search?${searchQuery(filters)}`, { token }),

  createVehicle: (token: string, input: VehicleInput) =>
    request<{ vehicle: Vehicle }>('/api/vehicles', { method: 'POST', token, body: input }),

  updateVehicle: (token: string, id: string, input: Omit<VehicleInput, 'quantity'>) =>
    request<{ vehicle: Vehicle }>(`/api/vehicles/${id}`, { method: 'PUT', token, body: input }),

  deleteVehicle: (token: string, id: string) =>
    request<undefined>(`/api/vehicles/${id}`, { method: 'DELETE', token }),

  purchaseVehicle: (token: string, id: string, quantity = 1) =>
    request<{ purchase: { id: string }; vehicle: Vehicle }>(`/api/vehicles/${id}/purchase`, {
      method: 'POST',
      token,
      body: { quantity },
    }),

  restockVehicle: (token: string, id: string, quantity: number) =>
    request<{ vehicle: Vehicle }>(`/api/vehicles/${id}/restock`, {
      method: 'POST',
      token,
      body: { quantity },
    }),
};
