import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { suggestNextWorkout } from '@/lib/next-workout-query';

// Next workout of the active program (epic 1.6) on real history: the last
// workout finished in the program, workouts done today in the user's zone.

async function seed(scheduleMode: 'ROTATION' | 'FIXED_DAYS', timezone = 'UTC') {
  const user = await db.user.create({
    data: { email: `next-${scheduleMode}-${timezone}@test.dev`, passwordHash: 'x', timezone },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Next bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: 'Split', phase: 'Base', isActive: true, scheduleMode },
  });
  const workouts = [];
  for (const [order, name, dayOfWeek] of [
    [1, 'A', 1],
    [2, 'B', 3],
    [3, 'C', 5],
  ] as const) {
    const workout = await db.workout.create({
      data: { programId: program.id, name, order, dayOfWeek },
    });
    await db.programExercise.create({
      data: {
        workoutId: workout.id,
        exerciseId: bench.id,
        order: 1,
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetRIR: 2,
        restSec: 120,
      },
    });
    workouts.push(workout);
  }
  const loaded = await db.program.findUniqueOrThrow({
    where: { id: program.id },
    include: { workouts: { include: { _count: { select: { exercises: true } } } } },
  });
  return { user, program: loaded, a: workouts[0]!, b: workouts[1]!, c: workouts[2]! };
}

async function finished(userId: string, programId: string, workoutId: string, startedAt: Date) {
  await db.session.create({
    data: {
      userId,
      programId,
      workoutId,
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 3_600_000),
    },
  });
}

describe('suggestNextWorkout', () => {
  it('rotates after the last finished workout, ignoring unfinished ones', async () => {
    const { user, program, a, b, c } = await seed('ROTATION');
    await finished(user.id, program.id, a.id, new Date('2026-10-01T10:00:00Z'));
    await finished(user.id, program.id, b.id, new Date('2026-10-03T10:00:00Z'));
    await db.session.create({
      data: {
        userId: user.id,
        programId: program.id,
        workoutId: c.id,
        startedAt: new Date('2026-10-04T10:00:00Z'),
      },
    });

    const next = await suggestNextWorkout(user.id, program, new Date('2026-10-05T12:00:00Z'));

    expect(next).toMatchObject({ kind: 'rotation', workoutId: c.id, afterWorkoutId: b.id });
  });

  it("suggests today's workout by weekday, in the user's time zone", async () => {
    const { user, program, a, b } = await seed('FIXED_DAYS', 'America/Sao_Paulo');

    // Wednesday 01:00 UTC is still Tuesday evening in São Paulo: rest day.
    const tuesdayNight = await suggestNextWorkout(
      user.id,
      program,
      new Date('2026-10-07T01:00:00Z'),
    );
    expect(tuesdayNight).toEqual({ kind: 'upcoming', workoutId: b.id, dayOfWeek: 3, inDays: 1 });

    // Monday morning in São Paulo: workout A.
    const monday = await suggestNextWorkout(user.id, program, new Date('2026-10-05T12:00:00Z'));
    expect(monday).toEqual({ kind: 'today', workoutId: a.id });
  });

  it("moves on to the next scheduled day once today's workout is done", async () => {
    const { user, program, a, b } = await seed('FIXED_DAYS');
    await finished(user.id, program.id, a.id, new Date('2026-10-05T08:00:00Z'));

    const later = await suggestNextWorkout(user.id, program, new Date('2026-10-05T18:00:00Z'));

    expect(later).toEqual({ kind: 'upcoming', workoutId: b.id, dayOfWeek: 3, inDays: 2 });
  });
});
