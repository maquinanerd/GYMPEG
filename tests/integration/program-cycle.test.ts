import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { cycleWeekAt, programCycle } from '@/lib/program-cycle';

// Mesocycle (epic 1.6): a program repeats over N weeks, the lifter places
// the cycle on the calendar ("I am in week k"), a session records the week it
// ran in, and the deload week's lighter targets are frozen on its sets.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { PUT as updateProgram } from '@/app/api/programs/[id]/route';
import { POST as startSession } from '@/app/api/sessions/route';
import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';
import { GET as listRevisions } from '@/app/api/programs/[id]/revisions/route';

function jsonReq(method: string, body?: unknown): Request {
  return new Request('http://test.local/api', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function seed() {
  const user = await db.user.create({
    data: { email: 'cycle@test.dev', passwordHash: 'x', timezone: 'UTC' },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Cycle bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: 'Block', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push', order: 1 },
  });
  await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 1,
      targetSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRIR: 2,
      restSec: 150,
    },
  });
  mockUserId.mockResolvedValue(user.id);
  return { user, bench, program, workout };
}

const programBody = (extra: Record<string, unknown>) => ({
  name: 'Block',
  phase: 'Base',
  ...extra,
});

beforeEach(() => mockUserId.mockReset());

describe('program cycle', () => {
  it('places the cycle so that this week is the week the lifter says', async () => {
    const { program } = await seed();

    const res = await updateProgram(
      jsonReq('PUT', programBody({ cycleWeeks: 4, cycleDeloadWeek: 4, cycleCurrentWeek: 3 })),
      params(program.id),
    );

    expect(res.status).toBe(200);
    const stored = await db.program.findUniqueOrThrow({ where: { id: program.id } });
    expect(stored).toMatchObject({ cycleWeeks: 4, cycleDeloadWeek: 4 });
    expect(cycleWeekAt(programCycle(stored)!, new Date(), 'UTC')).toBe(3);
  });

  it('refuses a deload week outside the cycle', async () => {
    const { program } = await seed();

    const res = await updateProgram(
      jsonReq('PUT', programBody({ cycleWeeks: 3, cycleDeloadWeek: 4 })),
      params(program.id),
    );

    expect(res.status).toBe(400);
  });

  it('removes the whole cycle with cycleWeeks null', async () => {
    const { program } = await seed();
    await updateProgram(
      jsonReq('PUT', programBody({ cycleWeeks: 4, cycleDeloadWeek: 4, cycleCurrentWeek: 1 })),
      params(program.id),
    );

    await updateProgram(jsonReq('PUT', programBody({ cycleWeeks: null })), params(program.id));

    expect(await db.program.findUniqueOrThrow({ where: { id: program.id } })).toMatchObject({
      cycleWeeks: null,
      cycleDeloadWeek: null,
      cycleAnchor: null,
    });
  });

  it('keeps the calendar position when other fields change', async () => {
    const { program } = await seed();
    await updateProgram(
      jsonReq('PUT', programBody({ cycleWeeks: 4, cycleCurrentWeek: 2 })),
      params(program.id),
    );
    const before = await db.program.findUniqueOrThrow({ where: { id: program.id } });

    await updateProgram(
      jsonReq('PUT', programBody({ name: 'Block renamed', cycleWeeks: 4, cycleDeloadWeek: 4 })),
      params(program.id),
    );

    const after = await db.program.findUniqueOrThrow({ where: { id: program.id } });
    expect(after.cycleAnchor).toEqual(before.cycleAnchor);
    expect(after.cycleDeloadWeek).toBe(4);
  });

  it('records the week a session ran and freezes the deload targets on its sets', async () => {
    const { program, workout, bench } = await seed();
    await updateProgram(
      jsonReq('PUT', programBody({ cycleWeeks: 4, cycleDeloadWeek: 4, cycleCurrentWeek: 4 })),
      params(program.id),
    );

    const session = await (await startSession(jsonReq('POST', { workoutId: workout.id }))).json();
    expect(session.cycleWeek).toBe(4);

    const set = await (
      await postSet(
        jsonReq('POST', { exerciseId: bench.id, setNumber: 1, weight: 60, reps: 8, rir: 4 }),
        params(session.id),
      )
    ).json();
    // Deload week: RIR 2 + 2.
    expect(set).toMatchObject({ targetRepsMin: 6, targetRepsMax: 8, targetRir: 4 });
  });

  it('keeps the regular targets outside the deload week', async () => {
    const { program, workout, bench } = await seed();
    await updateProgram(
      jsonReq('PUT', programBody({ cycleWeeks: 4, cycleDeloadWeek: 4, cycleCurrentWeek: 2 })),
      params(program.id),
    );

    const session = await (await startSession(jsonReq('POST', { workoutId: workout.id }))).json();
    const set = await (
      await postSet(
        jsonReq('POST', { exerciseId: bench.id, setNumber: 1, weight: 80, reps: 8, rir: 2 }),
        params(session.id),
      )
    ).json();

    expect(session.cycleWeek).toBe(2);
    expect(set.targetRir).toBe(2);
  });

  it('makes the cycle part of the program versions', async () => {
    const { program } = await seed();
    await updateProgram(
      jsonReq('PUT', programBody({ cycleWeeks: 5, cycleDeloadWeek: 5 })),
      params(program.id),
    );

    const versions = await (await listRevisions(jsonReq('GET'), params(program.id))).json();
    const latest = await db.programRevision.findUniqueOrThrow({ where: { id: versions[0].id } });
    expect(latest.snapshot).toMatchObject({ cycleWeeks: 5, cycleDeloadWeek: 5 });
  });
});
