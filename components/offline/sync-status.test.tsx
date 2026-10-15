import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const sync = vi.hoisted(() => ({
  pending: 0,
  flushPendingSets: vi.fn(async () => ({})),
}));

vi.mock('dexie-react-hooks', () => ({
  // The live query resolves to the mocked outbox count.
  useLiveQuery: () => sync.pending,
}));
vi.mock('@/lib/sync', () => ({
  countUnsyncedItems: async () => sync.pending,
  flushPendingSets: sync.flushPendingSets,
}));

import { SyncStatus } from './sync-status';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

describe('SyncStatus', () => {
  beforeEach(() => {
    sync.pending = 0;
    sync.flushPendingSets.mockClear();
    setOnline(true);
  });
  afterEach(() => setOnline(true));

  it('reads "Saved" when online with an empty outbox', () => {
    render(<SyncStatus />);
    const button = screen.getByRole('button', { name: 'Everything is synced' });
    expect(button).toHaveAttribute('data-sync-state', 'synced');
    expect(button).toHaveTextContent('Saved');
  });

  it('counts the queued items and flushes them on tap', async () => {
    sync.pending = 3;
    const user = userEvent.setup();
    render(<SyncStatus />);
    const button = screen.getByRole('button', { name: /3 changes waiting to sync/ });
    expect(button).toHaveAttribute('data-sync-state', 'pending');
    expect(button).toHaveTextContent('3 to send');
    await user.click(button);
    expect(sync.flushPendingSets).toHaveBeenCalledTimes(1);
  });

  it('shows offline, with the pending count, and does not try to flush', async () => {
    sync.pending = 2;
    setOnline(false);
    const user = userEvent.setup();
    render(<SyncStatus />);
    const button = screen.getByRole('button', { name: 'Offline · 2 pending' });
    expect(button).toHaveAttribute('data-sync-state', 'offline');
    expect(button).toHaveTextContent('No connection');
    await user.click(button);
    expect(sync.flushPendingSets).not.toHaveBeenCalled();

    // Coming back online switches to the pending state.
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByRole('button', { name: /2 changes waiting to sync/ })).toBeInTheDocument();
  });

  it('keeps only the icon in the compact form, with the full sentence as its name', () => {
    render(<SyncStatus compact />);
    const button = screen.getByRole('button', { name: 'Everything is synced' });
    expect(button).not.toHaveTextContent('Saved');
  });
});
