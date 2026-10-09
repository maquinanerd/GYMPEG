import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { weeklyAdherence } from '@/lib/adherence';

// Weekly adherence to the active program (epic 2.3): planned sessions from
// the schedule, prescribed sets of the sessions done, in the lifter's week.

async function seed(scheduleMode: 'ROTATION' | 'FIXED_DAYS') {
  const user = await db.user.create({
    data: { email: `adherence-${scheduleMode}@test.dev`, passwordHash: 'x' },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: 'Block', phase: 'Base', isActive: true, scheduleMode },
  });
  const exercise = await db.exercise.create({
    data: { userId: user.id, name: 'Squat', muscleGroup: 'QUADS', category: 'COMPOUND' },
  });
  const workouts = await Promise.all(
    [1, 3, 5].map((dayOfWeek, order) =>
      db.workout.create({
        data: {
          programId: program.id,
          name: `Day ${order + 1}`,
          order,
          dayOfWeek: scheduleMode === 'FIXED_DAYS' ? dayOfWeek : null,
        },
      }),
    ),
  );
  for (const workout of workouts) {
    await db.programExercise.createMany({
      data: [0, 1].map((order) => ({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order,
        targetSets: 3,
        targetRepsMin: 6,
        targetRepsMax: 8,
        targetRIR: 2,
        restSec: 120,
      })),
    });
  }
  const now = new Date();
  const done = await db.session.create({
    data: {
      userId: user.id,
      programId: program.id,
      workoutId: workouts[0]!.id,
      startedAt: now,
      finishedAt: now,
    },
  });
  await db.set.createMany({
    data: [
      ...[1, 2, 3, 4].map((setNumber) => ({
        sessionId: done.id,
        exerciseId: exercise.id,
        setNumber,
        weight: 100,
        reps: 6,
      })),
      // Warm-ups are not working sets.
      {
        sessionId: done.id,
        exerciseId: exercise.id,
        setNumber: 5,
        weight: 40,
        reps: 8,
        isWarmup: true,
      },
    ],
  });
  const loaded = await db.program.findUniqueOrThrow({
    where: { id: program.id },
    include: { workouts: { select: { id: true, dayOfWeek: true } } },
  });
  return { user, program: loaded, now };
}

describe('weeklyAdherence', () => {
  it('plans the fixed weekdays and counts the prescribed sets of the sessions done', async () => {
    const { user, program, now } = await seed('FIXED_DAYS');

    const adherence = await weeklyAdherence(user.id, program, {
      now,
      timeZone: 'UTC',
      weeklyFrequency: null,
    });

    expect(adherence).toEqual({
      sessionsDone: 1,
      sessionsPlanned: 3,
      setsDone: 4,
      setsPrescribed: 6,
      sessionRatio: 0.33,
      setRatio: 0.67,
    });
  });

  it("plans a rotation by the lifter's weekly frequency", async () => {
    const { user, program, now } = await seed('ROTATION');

    const adherence = await weeklyAdherence(user.id, program, {
      now,
      timeZone: 'UTC',
      weeklyFrequency: 4,
    });

    expect(adherence).toMatchObject({ sessionsDone: 1, sessionsPlanned: 4, sessionRatio: 0.25 });
  });
});
