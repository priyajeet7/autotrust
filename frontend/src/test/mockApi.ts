import { vi } from 'vitest';

export interface RecordedCall {
  method: string;
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

type Reply = { status: number; body?: unknown };
type Handler = Reply | ((call: RecordedCall) => Reply);

/**
 * Replaces global fetch with a route table keyed by "METHOD /path" (query string ignored).
 * Unmatched requests fail the test loudly. Returns the list of recorded calls.
 */
export function mockApi(routes: Record<string, Handler>): RecordedCall[] {
  const calls: RecordedCall[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toUpperCase();
      const call: RecordedCall = {
        method,
        url: input,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        headers: (init.headers ?? {}) as Record<string, string>,
      };
      calls.push(call);

      const handler = routes[`${method} ${input.split('?')[0] ?? ''}`];
      if (!handler) throw new Error(`Unexpected request: ${method} ${input}`);
      const reply = typeof handler === 'function' ? handler(call) : handler;

      return Promise.resolve(
        new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
          status: reply.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );

  return calls;
}

export const sampleUser = {
  id: 'u-1',
  name: 'Asha Verma',
  email: 'asha@example.com',
  role: 'USER' as const,
};
export const sampleAdmin = { ...sampleUser, id: 'u-2', name: 'Ada Admin', role: 'ADMIN' as const };

export function makeVehicle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v-1',
    make: 'Toyota',
    model: 'Corolla',
    year: 2024,
    category: 'SEDAN',
    price: 21500,
    quantity: 6,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
    ...overrides,
  };
}
