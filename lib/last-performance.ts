import { db } from '@/lib/db';

export interface LastPerformance {
  exerciseId: string;
  // The most recent previous session for this exercise (excluding the current session).
  sessionStartedAt: Date;
  sets: { weight: number; reps: number; rir: number | null }[];
  // Best load of the session (handy for a quick display).
  maxWeight: number;
  // Reps at that max load (the highest rep count reached at maxWeight).
  repsAtMaxWeight: number;
  // Cardio totals for the session (issue #176): summed duration/distance and
  // an averaged heart rate across the session's cardio sets. Null for strength
  // exercises (no cardio sets), so the session UI can branch on `cardio`.
  cardio: { durationSec: number; distanceM: number; avgHr: number | null } | null;
  // True when it comes from the same workout (the same prescription line,
  // ADR-007); false when that workout has no history yet and the exercise's
  // latest session anywhere stands in.
  sameWorkout: boolean;
}

// Fetches the previous performances for a list of exerciseIds, excluding the
// current session. Progression is per prescription (ADR-007): with a
// `workoutId`, the latest session of that workout wins, so a heavy day and a
// light day of the same exercise do not drive each other; without one (or
// with no history there yet), the exercise's latest session anywhere. Then all
// of that session's non-warmup sets of the exercise.
export async function getLastPerformances(
  userId: string,
  exerciseIds: string[],
  excludeSessionId: string | null,
  options: { workoutId?: string | null } = {},
): Promise<Map<string, LastPerformance>> {
  if (exerciseIds.length === 0) return new Map();

  const result = new Map<string, LastPerformance>();

  const latestSet = (exerciseId: string, workoutId?: string) =>
    db.set.findFirst({
      where: {
        exerciseId,
        isWarmup: false,
        ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
        session: { userId, ...(workoutId ? { workoutId } : {}) },
      },
      orderBy: { completedAt: 'desc' },
      include: { session: { select: { startedAt: true, id: true } } },
    });

  await Promise.all(
    exerciseIds.map(async (exerciseId) => {
      const fromWorkout = options.workoutId ? await latestSet(exerciseId, options.workoutId) : null;
      const lastSet = fromWorkout ?? (await latestSet(exerciseId));
      if (!lastSet) return;

      const rows = await db.set.findMany({
        where: {
          sessionId: lastSet.sessionId,
          exerciseId,
          isWarmup: false,
        },
        orderBy: { setNumber: 'asc' },
        select: {
          weight: true,
          reps: true,
          rir: true,
          durationSec: true,
          distanceM: true,
          avgHr: true,
        },
      });

      const sets = rows.map(({ weight, reps, rir }) => ({ weight, reps, rir }));

      const maxWeight = Math.max(...sets.map((s) => s.weight));
      const repsAtMaxWeight = Math.max(
        ...sets.filter((s) => s.weight === maxWeight).map((s) => s.reps),
      );

      // Cardio totals (issue #176): a cardio set carries durationSec != null.
      // Sum duration/distance over the session's cardio sets and average the
      // heart rate across the sets that recorded one. Null when there are no
      // cardio sets (a strength exercise), so the UI branches cleanly.
      const cardioRows = rows.filter((r) => r.durationSec != null);
      let cardio: LastPerformance['cardio'] = null;
      if (cardioRows.length > 0) {
        const durationSec = cardioRows.reduce((acc, r) => acc + (r.durationSec ?? 0), 0);
        const distanceM = cardioRows.reduce((acc, r) => acc + (r.distanceM ?? 0), 0);
        const hrRows = cardioRows.filter((r) => r.avgHr != null);
        const avgHr =
          hrRows.length > 0
            ? Math.round(hrRows.reduce((acc, r) => acc + (r.avgHr ?? 0), 0) / hrRows.length)
            : null;
        cardio = { durationSec, distanceM, avgHr };
      }

      result.set(exerciseId, {
        exerciseId,
        sessionStartedAt: lastSet.session.startedAt,
        sets,
        maxWeight,
        repsAtMaxWeight,
        cardio,
        sameWorkout: fromWorkout != null,
      });
    }),
  );

  return result;
}
