// Stored personal records (epic 2.2). When a session is finished, what it
// beat is computed by the pure engine (lib/training-engine/records) against
// every earlier finished session, and kept with the previous best. Recomputed
// from scratch for that session each time, so a replayed finish or a late
// correction never duplicates a record.

import { db } from '@/lib/db';
import { effectiveWeight, isoWeekKey } from '@/lib/stats';
import { detectSessionRecords, type RecordSet } from '@/lib/training-engine/records';
import { getUserTimeZone } from '@/lib/user-timezone';

export async function recordSessionPersonalRecords(
  userId: string,
  sessionId: string,
): Promise<number> {
  const session = await db.session.findFirst({
    where: { id: sessionId, userId, finishedAt: { not: null } },
    select: { id: true, startedAt: true, finishedAt: true },
  });
  if (!session?.finishedAt) return 0;

  const [timeZone, user, rows] = await Promise.all([
    getUserTimeZone(userId),
    db.user.findUnique({ where: { id: userId }, select: { bodyweight: true } }),
    // Working strength sets of this session and of every finished one before.
    db.set.findMany({
      where: {
        isWarmup: false,
        durationSec: null,
        exercise: { category: { not: 'CARDIO' } },
        session: { userId, finishedAt: { not: null }, startedAt: { lte: session.startedAt } },
      },
      select: {
        sessionId: true,
        exerciseId: true,
        weight: true,
        reps: true,
        bodyweightKgSnapshot: true,
        exercise: { select: { usesBodyweight: true } },
        session: { select: { startedAt: true } },
      },
    }),
  ]);

  const sessionSets: RecordSet[] = [];
  const priorSets: RecordSet[] = [];
  for (const row of rows) {
    const weight = effectiveWeight(
      row.weight,
      row.exercise.usesBodyweight,
      row.bodyweightKgSnapshot ?? user?.bodyweight,
    );
    if (weight <= 0 || row.reps <= 0) continue;
    const set: RecordSet = {
      sessionId: row.sessionId,
      exerciseId: row.exerciseId,
      weekKey: isoWeekKey(row.session.startedAt, timeZone),
      weight,
      reps: row.reps,
    };
    (row.sessionId === session.id ? sessionSets : priorSets).push(set);
  }

  const records = detectSessionRecords({ sessionSets, priorSets });
  await db.$transaction([
    db.personalRecord.deleteMany({ where: { sessionId: session.id } }),
    db.personalRecord.createMany({
      data: records.map((record) => ({
        userId,
        sessionId: session.id,
        exerciseId: record.exerciseId,
        type: record.type,
        value: record.value,
        previousValue: record.previous,
        weightKg: record.weightKg ?? null,
        reps: record.reps ?? null,
        achievedAt: session.finishedAt!,
      })),
    }),
  ]);
  return records.length;
}

// The latest records of the user, newest first, with the exercise name.
export async function recentPersonalRecords(userId: string, since: Date, take = 5) {
  const records = await db.personalRecord.findMany({
    where: { userId, achievedAt: { gte: since } },
    orderBy: [{ achievedAt: 'desc' }, { type: 'asc' }],
    take,
  });
  const exerciseIds = [
    ...new Set(records.map((record) => record.exerciseId).filter((id): id is string => !!id)),
  ];
  const exercises = exerciseIds.length
    ? await db.exercise.findMany({
        where: { id: { in: exerciseIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  return records.map((record) => ({
    ...record,
    exerciseName: record.exerciseId ? (names.get(record.exerciseId) ?? null) : null,
  }));
}
