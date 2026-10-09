import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalDB, getDB, type LocalSession } from '@/lib/indexeddb';
import { setOutboxOwner } from '@/lib/outbox-owner';
import type { SessionPack } from '@/app/api/session-pack/route';

// The runner itself is covered by its own tests: here it only reports which
// session and props it was given.
vi.mock('@/components/session/session-runner', () => ({
  SessionRunner: (props: { session: { id: string; workout: { name: string } } }) => (
    <div data-testid="runner">
      {props.session.id} {props.session.workout.name}
    </div>
  ),
}));

import { LocalSessionRunner } from './local-session-runner';

const SESSION_ID = '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e1f';

function localSession(overrides: Partial<LocalSession> = {}): LocalSession {
  return {
    id: SESSION_ID,
    ownerId: 'user-1',
    workoutId: 'workout-1',
    gymId: null,
    startedAt: Date.now(),
    finishedAt: null,
    notes: null,
    createStatus: 'pending',
    finishStatus: 'none',
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

const pack = {
  generatedAt: new Date().toISOString(),
  program: null,
  unit: 'KG',
  deloadActive: false,
  readiness: null,
  activeGymId: null,
  catalog: [],
  gyms: [],
  workouts: [
    {
      workout: { id: 'workout-1', programId: 'program-1', name: 'Push day', exercises: [] },
      lastPerformances: {},
      returnRecommendations: {},
    },
  ],
} as unknown as SessionPack;

beforeEach(async () => {
  await deleteLocalDB();
  setOutboxOwner('user-1');
});

describe('LocalSessionRunner', () => {
  it('runs a session recorded on this device from the training pack', async () => {
    await getDB().localSessions.add(localSession());
    await getDB().trainingPacks.put({ ownerId: 'user-1', savedAt: Date.now(), pack });

    render(<LocalSessionRunner sessionId={SESSION_ID} />);

    expect(await screen.findByTestId('runner')).toHaveTextContent(`${SESSION_ID} Push day`);
  });

  it('says the session is unknown here, including when another account owns it', async () => {
    await getDB().localSessions.add(localSession({ ownerId: 'user-2' }));

    render(<LocalSessionRunner sessionId={SESSION_ID} />);

    expect(await screen.findByText('Workout not found on this device')).toBeInTheDocument();
    expect(screen.queryByTestId('runner')).not.toBeInTheDocument();
  });

  it('does not reopen a session finished on this device', async () => {
    await getDB().localSessions.add(localSession({ finishedAt: Date.now() }));
    await getDB().trainingPacks.put({ ownerId: 'user-1', savedAt: Date.now(), pack });

    render(<LocalSessionRunner sessionId={SESSION_ID} />);

    expect(await screen.findByText('Workout finished on this device')).toBeInTheDocument();
  });

  it('explains that the workout must be downloaded once with internet', async () => {
    await getDB().localSessions.add(localSession());

    render(<LocalSessionRunner sessionId={SESSION_ID} />);

    expect(await screen.findByText('Workout not available offline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to the home screen' })).toBeInTheDocument();
  });
});
