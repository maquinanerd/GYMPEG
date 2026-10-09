import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';

// The engine's next-load decision is recorded when a session starts (ADR-007):
// per prescription line, from that line's own history, with the inputs and
// the guideline version, once per session.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as startSession } from '@/app/api/sessions/route';

const start = (body: unknown) =>
  startSession(
    new Request('http://test.local/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

async function seed() {
  const user = await db.user.create({ data: { email: 'engine@test.dev', passwordHash: 'x' } });
  const program = await db.program.create({
    data: { userId: user.id, name: 'Block', phase: 'Base', isActive: true },
  });
  const heavy = await db.workout.create({
    data: { programId: program.id, name: 'Heavy', order: 0 },
  });
  const light = await db.workout.create({
    data: { programId: program.id, name: 'Light', order: 1 },
  });
  const squat = await db.exercise.create({
    data: { userId: user.id, name: 'Squat', muscleGroup: 'QUADS', category: 'COMPOUND' },
  });
  const bike = await db.exercise.create({
    data: { userId: user.id, name: 'Bike', muscleGroup: 'OTHER', category: 'CARDIO' },
  });
  const row = await db.programExercise.create({
    data: {
      workoutId: heavy.id,
      exerciseId: squat.id,
      order: 0,
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRIR: 2,
      restSec: 180,
    },
  });
  await db.programExercise.create({
    data: {
      workoutId: heavy.id,
      exerciseId: bike.id,
      order: 1,
      targetSets: 1,
      targetRepsMin: 1,
      targetRepsMax: 1,
      targetRIR: 0,
      restSec: 60,
    },
  });
  // Heavy day hit the top of the range; a more recent light day did not.
  const heavyDay = await db.session.create({
    data: {
      userId: user.id,
      workoutId: heavy.id,
      startedAt: new Date(Date.now() - 7 * 86_400_000),
      finishedAt: new Date(Date.now() - 7 * 86_400_000 + 3_600_000),
    },
  });
  const lightDay = await db.session.create({
    data: {
      userId: user.id,
      workoutId: light.id,
      startedAt: new Date(Date.now() - 2 * 86_400_000),
      finishedAt: new Date(Date.now() - 2 * 86_400_000 + 3_600_000),
    },
  });
  await db.set.createMany({
    data: [
      {
        sessionId: heavyDay.id,
        exerciseId: squat.id,
        setNumber: 1,
        weight: 140,
        reps: 8,
        completedAt: heavyDay.startedAt,
      },
      {
        sessionId: heavyDay.id,
        exerciseId: squat.id,
        setNumber: 2,
        weight: 140,
        reps: 8,
        completedAt: heavyDay.startedAt,
      },
      {
        sessionId: lightDay.id,
        exerciseId: squat.id,
        setNumber: 1,
        weight: 100,
        reps: 5,
        completedAt: lightDay.startedAt,
      },
    ],
  });
  return { user, heavy, squat, row };
}

beforeEach(() => mockUserId.mockReset());

describe('training recommendations at session start', () => {
  it("records the decision of each strength line from that line's own history", async () => {
    const { user, heavy, squat, row } = await seed();
    mockUserId.mockResolvedValue(user.id);

    const res = await start({ workoutId: heavy.id });
    expect(res.status).toBe(201);
    const session = (await res.json()) as { id: string };

    const records = await db.trainingRecommendation.findMany({ where: { sessionId: session.id } });
    // The cardio line gets no load decision.
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      userId: user.id,
      programExerciseId: row.id,
      exerciseId: squat.id,
      action: 'INCREASE',
      reason: 'top-of-range',
      valueKg: 142.5,
      guidelineVersion: TRAINING_GUIDELINE.version,
    });
    expect(records[0]!.inputs).toMatchObject({
      workingWeightKg: 140,
      targetRepsMin: 6,
      targetRepsMax: 8,
      unit: 'KG',
      history: { sameWorkout: true },
    });
  });

  it('records once per session: a replayed start adds nothing', async () => {
    const { user, heavy } = await seed();
    mockUserId.mockResolvedValue(user.id);
    const id = '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e99';

    expect((await start({ workoutId: heavy.id, id, startedAt: Date.now() })).status).toBe(201);
    expect((await start({ workoutId: heavy.id, id, startedAt: Date.now() })).status).toBe(200);

    await expect(db.trainingRecommendation.count({ where: { sessionId: id } })).resolves.toBe(1);
  });
});
