import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// What the live query over IndexedDB resolves to in each test.
const store = vi.hoisted(() => ({
  data: undefined as unknown,
  startSession: vi.fn(async () => ({ id: 'new-session', synced: false })),
}));

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => store.data }));
vi.mock('@/lib/indexeddb', () => ({ getDB: vi.fn() }));
vi.mock('@/lib/outbox-owner', () => ({ getOutboxOwner: () => 'u1' }));
vi.mock('@/lib/sync', () => ({ countUnsyncedItems: async () => 0 }));
vi.mock('@/lib/session-lifecycle', () => ({ startSession: store.startSession }));

import { OfflineHome } from './offline-home';

const pack = {
  program: { name: 'Upper Lower' },
  workouts: [{ workout: { id: 'w1', name: 'Upper A' } }, { workout: { id: 'w2', name: 'Lower A' } }],
};

describe('OfflineHome', () => {
  beforeEach(() => {
    store.startSession.mockClear();
  });

  it('says training still works and lists the stored workouts as rows', () => {
    store.data = { ownerId: 'u1', open: [], pack, pending: 2 };
    render(<OfflineHome />);
    expect(screen.getByRole('heading', { level: 1, name: 'No connection' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'You can train as usual. Everything is saved on this device.',
    );
    expect(screen.getByText(/waiting to be sent/)).toBeInTheDocument();
    // No workout in progress: no lime block.
    expect(screen.queryByTestId('offline-resume')).not.toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const start = within(rows[0]!).getByRole('button', { name: 'Start' });
    expect(start).toHaveAccessibleDescription('Upper A');
  });

  it('starts a workout from the device', async () => {
    store.data = { ownerId: 'u1', open: [], pack, pending: 0 };
    const user = userEvent.setup();
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });
    render(<OfflineHome />);
    await user.click(screen.getAllByRole('button', { name: 'Start' })[1]!);
    expect(store.startSession).toHaveBeenCalledWith({ workoutId: 'w2', gymId: null });
  });

  it('puts the workout in progress in the lime block', () => {
    store.data = {
      ownerId: 'u1',
      open: [{ id: 's1', workoutId: 'w1', startedAt: 1, finishedAt: null }],
      pack,
      pending: 0,
    };
    render(<OfflineHome />);
    const block = screen.getByTestId('offline-resume');
    expect(block).toHaveClass('bg-primary');
    expect(within(block).getByRole('heading', { name: 'Upper A' })).toBeInTheDocument();
    expect(within(block).getByRole('button', { name: 'Resume' })).toHaveClass('bg-ink');
  });

  it('explains what is missing when nothing is stored on the device', () => {
    store.data = { ownerId: 'u1', open: [], pack: undefined, pending: 0 };
    render(<OfflineHome />);
    expect(screen.getByText(/No workout is stored on this device yet/)).toBeInTheDocument();
  });
});
