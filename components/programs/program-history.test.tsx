import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramDiff } from '@/lib/program-snapshot';

const { refresh, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('sonner', () => ({ toast }));

import { ProgramHistory } from './program-history';
import { ProgramDiffView } from './program-diff-view';

const emptyDiff: ProgramDiff = {
  fields: [],
  workoutsAdded: [],
  workoutsRemoved: [],
  workoutsChanged: [],
};

const versions = [
  {
    id: 'rev-3',
    version: 3,
    source: 'RESTORE',
    summary: null,
    restoredFromVersion: 1,
    createdAt: '2026-10-09T12:00:00.000Z',
    sessionCount: 0,
  },
  {
    id: 'rev-2',
    version: 2,
    source: 'USER',
    summary: null,
    restoredFromVersion: null,
    createdAt: '2026-10-08T12:00:00.000Z',
    sessionCount: 2,
  },
  {
    id: 'rev-1',
    version: 1,
    source: 'CREATED',
    summary: null,
    restoredFromVersion: null,
    createdAt: '2026-10-07T12:00:00.000Z',
    sessionCount: 0,
  },
];

const v2Detail = {
  changesFromPrevious: {
    ...emptyDiff,
    workoutsAdded: [{ name: 'Upper', exercises: ['Bench press'] }],
  },
  changesToRestore: {
    ...emptyDiff,
    workoutsChanged: [
      {
        name: 'Upper',
        fields: [],
        exercisesAdded: [],
        exercisesRemoved: [],
        exercisesChanged: [
          { name: 'Bench press', fields: [{ field: 'targetSets', from: 5, to: 3 }] },
        ],
        reordered: false,
      },
    ],
  },
};

type Handler = (url: string, init?: RequestInit) => { status: number; body: unknown };

function stubApi(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const defaultApi: Handler = (url, init) => {
  if (url.endsWith('/restore') && init?.method === 'POST') {
    return { status: 201, body: { id: 'rev-4', version: 4, restoredFromVersion: 2 } };
  }
  if (url.endsWith('/revisions/rev-2')) return { status: 200, body: v2Detail };
  return { status: 200, body: versions };
};

beforeEach(() => {
  refresh.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe('ProgramHistory', () => {
  it('lists the versions on demand, newest first, with their origin', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(defaultApi);
    render(<ProgramHistory programId="program-1" />);

    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Show history' }));

    const current = await screen.findByTestId('program-version-3');
    expect(current).toHaveTextContent('Version 3');
    expect(current).toHaveTextContent('Current');
    expect(current).toHaveTextContent('Restored from version 1');
    expect(screen.getByTestId('program-version-2')).toHaveTextContent('used in 2 sessions');
    expect(screen.getByTestId('program-version-1')).toHaveTextContent('Program created');
  });

  it('shows what a version changed and restores it after confirmation', async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi(defaultApi);
    render(<ProgramHistory programId="program-1" />);
    await user.click(screen.getByRole('button', { name: 'Show history' }));

    const v2 = await screen.findByTestId('program-version-2');
    await user.click(within(v2).getByRole('button', { name: 'Details' }));

    expect(await within(v2).findByText('New workout: Upper')).toBeInTheDocument();
    expect(within(v2).getByText(/Bench press · Sets: 5 → 3/)).toBeInTheDocument();
    await user.click(within(v2).getByRole('button', { name: 'Restore this version' }));
    await user.click(await screen.findByRole('button', { name: 'Restore this version' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Version 2 restored.'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/programs/program-1/revisions/rev-2/restore',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('offers no restore for the current version', async () => {
    const user = userEvent.setup();
    stubApi((url) =>
      url.endsWith('/revisions/rev-3')
        ? { status: 200, body: { changesFromPrevious: emptyDiff, changesToRestore: emptyDiff } }
        : defaultApi(url),
    );
    render(<ProgramHistory programId="program-1" />);
    await user.click(screen.getByRole('button', { name: 'Show history' }));

    const current = await screen.findByTestId('program-version-3');
    await user.click(within(current).getByRole('button', { name: 'Details' }));

    expect(await within(current).findByText('No differences.')).toBeInTheDocument();
    expect(within(current).queryByRole('button', { name: 'Restore this version' })).toBeNull();
  });

  it('names the exercises that block a restore', async () => {
    const user = userEvent.setup();
    stubApi((url, init) =>
      url.endsWith('/restore')
        ? { status: 409, body: { error: 'x', missingExercises: ['Old row'] } }
        : defaultApi(url, init),
    );
    render(<ProgramHistory programId="program-1" />);
    await user.click(screen.getByRole('button', { name: 'Show history' }));
    const v2 = await screen.findByTestId('program-version-2');
    await user.click(within(v2).getByRole('button', { name: 'Details' }));
    await user.click(await within(v2).findByRole('button', { name: 'Restore this version' }));
    await user.click(await screen.findByRole('button', { name: 'Restore this version' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('These exercises no longer exist: Old row.'),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ProgramDiffView', () => {
  it('describes swaps, removals, reordering and field changes', () => {
    render(
      <ProgramDiffView
        diff={{
          fields: [{ field: 'name', from: 'Block A', to: 'Block B' }],
          workoutsAdded: [],
          workoutsRemoved: ['Lower'],
          workoutsChanged: [
            {
              name: 'Upper A',
              previousName: 'Upper',
              fields: [{ field: 'dayOfWeek', from: 1, to: 3 }],
              exercisesAdded: [],
              exercisesRemoved: ['Row'],
              exercisesChanged: [{ name: 'Lat pulldown', previousName: 'Pull-up', fields: [] }],
              reordered: true,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Name: Block A → Block B')).toBeInTheDocument();
    expect(screen.getByText('Workout removed: Lower')).toBeInTheDocument();
    expect(screen.getByText('Upper A (was Upper)')).toBeInTheDocument();
    expect(screen.getByText('Day: Monday → Wednesday')).toBeInTheDocument();
    expect(screen.getByText('Removed: Row')).toBeInTheDocument();
    expect(screen.getByText('Pull-up replaced by Lat pulldown')).toBeInTheDocument();
    expect(screen.getByText('Exercise order changed')).toBeInTheDocument();
  });
});
