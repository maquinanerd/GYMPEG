import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Unified logger (G1 epic 1.5): a set stores its kind (type, kept in agreement
// with the legacy isWarmup/isDropSet flags), an optional RPE, the prescription
// it was logged against (frozen, so later program edits do not rewrite it) and
// the lifter's bodyweight at log time for bodyweight exercises.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postSet } from '@/app/api/sessions/[id]/sets/route';
import { PATCH as patchSet } from '@/app/api/sets/[id]/route';

function jsonReq(method: string, body: unknown): Request {
  return new Request('http://test.local/api', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function post(sessionId: string, body: unknown) {
  return postSet(jsonReq('POST', body), { params: Promise.resolve({ id: sessionId }) });
}

async function seed() {
  const user = await db.user.create({
    data: { email: 'logger@test.dev', passwordHash: 'x', bodyweight: 82.5 },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const dips = await db.exercise.create({
    data: {
      userId: user.id,
      name: 'Dips',
      muscleGroup: 'CHEST',
      category: 'COMPOUND',
      usesBodyweight: true,
    },
  });
  const running = await db.exercise.create({
    data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: 'Block 1', phase: 'Base', isActive: true },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Push day', order: 1 },
  });
  const prescription = await db.programExercise.create({
    data: {
      workoutId: workout.id,
      exerciseId: bench.id,
      order: 1,
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 10,
      targetRIR: 2,
      restSec: 150,
    },
  });
  const session = await db.session.create({
    data: { userId: user.id, workoutId: workout.id },
  });
  return { user, bench, dips, running, prescription, session };
}

const strengthBody = (exerciseId: string, extra: Record<string, unknown> = {}) => ({
  exerciseId,
  setNumber: 1,
  weight: 80,
  reps: 8,
  rir: 2,
  ...extra,
});

beforeEach(() => mockUserId.mockReset());

describe('POST /api/sessions/[id]/sets - unified logger fields', () => {
  it('derives the type from the legacy flags of older clients', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const working = await (await post(session.id, strengthBody(bench.id))).json();
    const warmup = await (
      await post(session.id, strengthBody(bench.id, { setNumber: 2, isWarmup: true }))
    ).json();
    const drop = await (
      await post(session.id, strengthBody(bench.id, { setNumber: 3, isDropSet: true }))
    ).json();

    expect(working).toMatchObject({ type: 'WORKING', isWarmup: false, isDropSet: false });
    expect(warmup).toMatchObject({ type: 'WARMUP', isWarmup: true, isDropSet: false });
    expect(drop).toMatchObject({ type: 'DROP', isWarmup: false, isDropSet: true });
  });

  it('stores an explicit type and an RPE, with the flags in agreement', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const res = await post(
      session.id,
      strengthBody(bench.id, { type: 'AMRAP', isWarmup: true, rpe: 9.5 }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      type: 'AMRAP',
      isWarmup: false,
      isDropSet: false,
      rpe: 9.5,
    });
  });

  it('rejects an RPE off the half steps', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const res = await post(session.id, strengthBody(bench.id, { rpe: 8.3 }));

    expect(res.status).toBe(400);
    await expect(db.set.count({ where: { sessionId: session.id } })).resolves.toBe(0);
  });

  it('freezes the prescription the set was logged against', async () => {
    const { user, bench, prescription, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const created = await (await post(session.id, strengthBody(bench.id))).json();
    await db.programExercise.update({
      where: { id: prescription.id },
      data: { targetRepsMin: 12, targetRepsMax: 15, targetRIR: 1 },
    });

    const stored = await db.set.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored).toMatchObject({ targetRepsMin: 6, targetRepsMax: 10, targetRir: 2 });
  });

  it('leaves the targets empty for an exercise outside the workout', async () => {
    const { user, dips, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const created = await (await post(session.id, strengthBody(dips.id, { weight: 10 }))).json();

    expect(created).toMatchObject({ targetRepsMin: null, targetRepsMax: null, targetRir: null });
  });

  it('snapshots the bodyweight only on bodyweight exercises', async () => {
    const { user, bench, dips, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const dip = await (await post(session.id, strengthBody(dips.id, { weight: 10 }))).json();
    const press = await (await post(session.id, strengthBody(bench.id, { setNumber: 2 }))).json();
    await db.user.update({ where: { id: user.id }, data: { bodyweight: 90 } });

    expect(dip.bodyweightKgSnapshot).toBe(82.5);
    expect(press.bodyweightKgSnapshot).toBeNull();
    const stored = await db.set.findUniqueOrThrow({ where: { id: dip.id } });
    expect(stored.bodyweightKgSnapshot).toBe(82.5);
  });

  it('keeps RPE and targets empty on a cardio set', async () => {
    const { user, running, session } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const res = await post(session.id, {
      exerciseId: running.id,
      setNumber: 1,
      weight: 0,
      reps: 1,
      durationSec: 1200,
      rpe: 7,
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      type: 'WORKING',
      rpe: null,
      targetRepsMin: null,
      targetRir: null,
    });
  });
});

describe('PATCH /api/sets/[id] - RPE', () => {
  it('sets, keeps and clears the RPE of a logged set', async () => {
    const { user, bench, session } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const created = await (await post(session.id, strengthBody(bench.id))).json();
    const params = { params: Promise.resolve({ id: created.id as string }) };

    const set = await patchSet(jsonReq('PATCH', { weight: 80, reps: 8, rir: 2, rpe: 8 }), params);
    expect(set.status).toBe(200);
    expect((await db.set.findUniqueOrThrow({ where: { id: created.id } })).rpe).toBe(8);

    // An edit that does not mention the RPE leaves it alone.
    await patchSet(jsonReq('PATCH', { weight: 82.5, reps: 8, rir: 2 }), params);
    expect((await db.set.findUniqueOrThrow({ where: { id: created.id } })).rpe).toBe(8);

    await patchSet(jsonReq('PATCH', { weight: 82.5, reps: 8, rir: 2, rpe: null }), params);
    expect((await db.set.findUniqueOrThrow({ where: { id: created.id } })).rpe).toBeNull();
  });
});
