import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Vehicle } from '../api/types';
import { makeVehicle } from '../test/mockApi';
import { VehicleCard } from './VehicleCard';

function renderCard(overrides: Partial<Vehicle> = {}, isAdmin = false) {
  const handlers = {
    onPurchase: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRestock: vi.fn(),
  };
  render(
    <VehicleCard vehicle={makeVehicle(overrides) as Vehicle} isAdmin={isAdmin} {...handlers} />,
  );
  return handlers;
}

describe('VehicleCard', () => {
  it('shows the vehicle details, formatted price and stock', () => {
    renderCard({ price: 21500, quantity: 6 });

    expect(screen.getByRole('heading', { name: 'Toyota Corolla' })).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('Sedan')).toBeInTheDocument();
    expect(screen.getByText('$21,500')).toBeInTheDocument();
    expect(screen.getByText('6 in stock')).toBeInTheDocument();
  });

  it('enables purchase when in stock and reports the vehicle on click', async () => {
    const { onPurchase } = renderCard({ quantity: 2 });

    await userEvent.click(screen.getByRole('button', { name: 'Purchase' }));

    expect(onPurchase).toHaveBeenCalledWith(expect.objectContaining({ id: 'v-1' }));
  });

  it('disables purchase and says "Out of stock" when quantity is zero', async () => {
    const { onPurchase } = renderCard({ quantity: 0 });

    const button = screen.getByRole('button', { name: 'Out of stock' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('hides admin controls from regular users', () => {
    renderCard({}, false);

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restock' })).not.toBeInTheDocument();
  });

  it('lets an admin restock by a chosen quantity', async () => {
    const { onRestock } = renderCard({ quantity: 0 }, true);

    const input = screen.getByLabelText('Restock quantity');
    await userEvent.clear(input);
    await userEvent.type(input, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Restock' }));

    expect(onRestock).toHaveBeenCalledWith(expect.objectContaining({ id: 'v-1' }), 3);
  });

  it('asks an admin to confirm before deleting', async () => {
    const { onDelete } = renderCard({}, true);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'v-1' }));
  });

  it('lets an admin start editing', async () => {
    const { onEdit } = renderCard({}, true);

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'v-1' }));
  });
});
