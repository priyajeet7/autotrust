import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { makeVehicle, mockApi, sampleAdmin, sampleUser } from './test/mockApi';

const TOKEN_KEY = 'autotrust.token';

const inventory = [
  makeVehicle({ id: 'v-1', make: 'Toyota', model: 'Corolla', quantity: 2 }),
  makeVehicle({ id: 'v-2', make: 'Honda', model: 'CR-V', category: 'SUV', quantity: 0 }),
];

function signedInAs(user: typeof sampleUser | typeof sampleAdmin) {
  localStorage.setItem(TOKEN_KEY, 'stored-token');
  return { 'GET /api/auth/me': { status: 200, body: { data: { user } } } };
}

const listRoute = { 'GET /api/vehicles': { status: 200, body: { data: { vehicles: inventory } } } };

describe('authentication', () => {
  it('shows the sign-in form when there is no stored session', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Sign in to AutoTrust' })).toBeInTheDocument();
  });

  it('signs in, remembers the token and shows the inventory', async () => {
    const calls = mockApi({
      'POST /api/auth/login': {
        status: 200,
        body: { data: { token: 'new-token', user: sampleUser } },
      },
      ...listRoute,
    });
    render(<App />);

    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token');
    expect(calls[0]?.body).toEqual({
      email: 'asha@example.com',
      password: 'correct-horse-battery',
    });
  });

  it('shows the server error when sign-in fails', async () => {
    mockApi({
      'POST /api/auth/login': {
        status: 401,
        body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      },
    });
    render(<App />);

    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('registers a new account with name, email and password', async () => {
    const calls = mockApi({
      'POST /api/auth/register': {
        status: 201,
        body: { data: { token: 'reg-token', user: sampleUser } },
      },
      ...listRoute,
    });
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Asha Verma');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Asha Verma')).toBeInTheDocument();
    expect(calls[0]?.body).toEqual({
      name: 'Asha Verma',
      email: 'asha@example.com',
      password: 'correct-horse-battery',
    });
  });

  it('restores a stored session and signs out', async () => {
    mockApi({ ...signedInAs(sampleUser), ...listRoute });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Toyota Corolla' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(screen.getByRole('heading', { name: 'Sign in to AutoTrust' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('drops an expired stored session', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired');
    mockApi({
      'GET /api/auth/me': {
        status: 401,
        body: { error: { code: 'UNAUTHENTICATED', message: 'A valid bearer token is required' } },
      },
    });
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Sign in to AutoTrust' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe('inventory dashboard', () => {
  it('lists vehicles, with purchase disabled for the out-of-stock one', async () => {
    mockApi({ ...signedInAs(sampleUser), ...listRoute });
    render(<App />);

    const crv = (await screen.findByRole('heading', { name: 'Honda CR-V' })).closest('article');
    expect(within(crv as HTMLElement).getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  });

  it('searches with the entered filters and shows only the results', async () => {
    const calls = mockApi({
      ...signedInAs(sampleUser),
      ...listRoute,
      'GET /api/vehicles/search': {
        status: 200,
        body: { data: { vehicles: [inventory[1]] } },
      },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Toyota Corolla' });

    await userEvent.type(screen.getByLabelText('Make'), 'hon');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'SUV');
    await userEvent.type(screen.getByLabelText('Max price'), '40000');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('1 vehicle', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Toyota Corolla' })).not.toBeInTheDocument();
    expect(calls.at(-1)?.url).toBe('/api/vehicles/search?make=hon&category=SUV&maxPrice=40000');
  });

  it('purchases a vehicle and shows the new stock level', async () => {
    mockApi({
      ...signedInAs(sampleUser),
      ...listRoute,
      'POST /api/vehicles/v-1/purchase': {
        status: 201,
        body: { data: { purchase: { id: 'p-1' }, vehicle: { ...inventory[0], quantity: 1 } } },
      },
    });
    render(<App />);

    const corolla = (await screen.findByRole('heading', { name: 'Toyota Corolla' })).closest(
      'article',
    ) as HTMLElement;
    await userEvent.click(within(corolla).getByRole('button', { name: 'Purchase' }));

    expect(await within(corolla).findByText('1 in stock')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Purchased Toyota Corolla');
  });

  it('shows the server message when a purchase fails', async () => {
    mockApi({
      ...signedInAs(sampleUser),
      ...listRoute,
      'POST /api/vehicles/v-1/purchase': {
        status: 409,
        body: { error: { code: 'OUT_OF_STOCK', message: 'Not enough stock for this purchase' } },
      },
    });
    render(<App />);

    const corolla = (await screen.findByRole('heading', { name: 'Toyota Corolla' })).closest(
      'article',
    ) as HTMLElement;
    await userEvent.click(within(corolla).getByRole('button', { name: 'Purchase' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not enough stock for this purchase',
    );
  });

  it('hides "Add vehicle" from regular users', async () => {
    mockApi({ ...signedInAs(sampleUser), ...listRoute });
    render(<App />);
    await screen.findByRole('heading', { name: 'Toyota Corolla' });

    expect(screen.queryByRole('button', { name: 'Add vehicle' })).not.toBeInTheDocument();
  });

  it('lets an admin add a vehicle', async () => {
    const created = makeVehicle({ id: 'v-3', make: 'Ford', model: 'F-150', category: 'TRUCK' });
    const calls = mockApi({
      ...signedInAs(sampleAdmin),
      ...listRoute,
      'POST /api/vehicles': { status: 201, body: { data: { vehicle: created } } },
    });
    render(<App />);
    await screen.findByRole('heading', { name: 'Toyota Corolla' });

    await userEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
    const form = screen.getByRole('form', { name: 'Vehicle details' });
    await userEvent.type(within(form).getByLabelText('Make'), 'Ford');
    await userEvent.type(within(form).getByLabelText('Model'), 'F-150');
    await userEvent.clear(within(form).getByLabelText('Year'));
    await userEvent.type(within(form).getByLabelText('Year'), '2023');
    await userEvent.selectOptions(within(form).getByLabelText('Category'), 'TRUCK');
    await userEvent.type(within(form).getByLabelText('Price (USD)'), '45000');
    await userEvent.clear(within(form).getByLabelText('Initial stock'));
    await userEvent.type(within(form).getByLabelText('Initial stock'), '2');
    await userEvent.click(within(form).getByRole('button', { name: 'Save vehicle' }));

    expect(await screen.findByRole('heading', { name: 'Ford F-150' })).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({
      make: 'Ford',
      model: 'F-150',
      year: 2023,
      category: 'TRUCK',
      price: 45000,
      quantity: 2,
    });
  });

  it('lets an admin delete a vehicle after confirming', async () => {
    mockApi({
      ...signedInAs(sampleAdmin),
      ...listRoute,
      'DELETE /api/vehicles/v-1': { status: 204 },
    });
    render(<App />);

    const corolla = (await screen.findByRole('heading', { name: 'Toyota Corolla' })).closest(
      'article',
    ) as HTMLElement;
    await userEvent.click(within(corolla).getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(corolla).getByRole('button', { name: 'Confirm delete' }));

    await screen.findByRole('status');
    expect(screen.queryByRole('heading', { name: 'Toyota Corolla' })).not.toBeInTheDocument();
  });
});
