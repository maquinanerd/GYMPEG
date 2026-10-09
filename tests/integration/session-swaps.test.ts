import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Replacing an exercise only for one session (epic 1.6): the session stores
// the swap, the saved program and its versions do not change, and a set of
// the replacement takes the targets of the row it replaces.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { PUT as updateSession } from '@/app/api/sessions/[id]/route';
import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';

function jsonReq(method: string, body: unknown): Request {
  return new Request('http://test.local/api', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function seed(email = 'swaps@test.dev') {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const [bench, incline] = await Promise.all(
    ['Swap bench', 'Swap incline'].map((name) =>
      db.exercise.create({
        data: { userId: user.id, name, muscleGroup: 'CHEST', category: 'COMPOUND' },
      }),
    ),
  );
  const program = await db.program.create({
    data: { userId: user.id, name: 'Push block', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push', order: 1 },
  });
  const row = await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: bench!.id,
      order: 1,
      targetSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRIR: 1,
      restSec: 150,
    },
  });
  const session = await db.session.create({
    data: { userId: user.id, programId: program.id, workoutId: workout.id },
  });
  mockUserId.mockResolvedValue(user.id);
  return { user, bench: bench!, incline: incline!, row, session };
}

beforeEach(() => mockUserId.mockReset());

describe('PUT /api/sessions/[id] exerciseSwaps', () => {
  it('stores the swap for the session and leaves the saved program alone', async () => {
    const { bench, incline, row, session } = await seed();

    const res = await updateSession(
      jsonReq('PUT', { exerciseSwaps: { [row.id]: incline.id } }),
      params(session.id),
    );

    expect(res.status).toBe(200);
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: session.id } })).exerciseSwaps,
    ).toEqual({ [row.id]: incline.id });
    expect((await db.programExercise.findUniqueOrThrow({ where: { id: row.id } })).exerciseId).toBe(
      bench.id,
    );
  });

  it('drops a swap back to the row’s own exercise', async () => {
    const { bench, incline, row, session } = await seed();
    await updateSession(
      jsonReq('PUT', { exerciseSwaps: { [row.id]: incline.id } }),
      params(session.id),
    );

    await updateSession(
      jsonReq('PUT', { exerciseSwaps: { [row.id]: bench.id } }),
      params(session.id),
    );

    expect(
      (await db.session.findUniqueOrThrow({ where: { id: session.id } })).exerciseSwaps,
    ).toEqual({});
  });

  it('refuses a row of another workout and an exercise of another account', async () => {
    const { session, row } = await seed();
    const other = await seed('swaps-other@test.dev');
    mockUserId.mockResolvedValue(session.userId);

    const foreignRow = await updateSession(
      jsonReq('PUT', { exerciseSwaps: { [other.row.id]: other.incline.id } }),
      params(session.id),
    );
    const foreignExercise = await updateSession(
      jsonReq('PUT', { exerciseSwaps: { [row.id]: other.incline.id } }),
      params(session.id),
    );

    expect([foreignRow.status, foreignExercise.status]).toEqual([400, 400]);
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: session.id } })).exerciseSwaps,
    ).toBeNull();
  });

  it('freezes the replaced row’s targets on a set of the replacement', async () => {
    const { incline, row, session } = await seed();
    await updateSession(
      jsonReq('PUT', { exerciseSwaps: { [row.id]: incline.id } }),
      params(session.id),
    );

    const res = await postSet(
      jsonReq('POST', { exerciseId: incline.id, setNumber: 1, weight: 30, reps: 8, rir: 1 }),
      params(session.id),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      exerciseId: incline.id,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRir: 1,
    });
  });
});
