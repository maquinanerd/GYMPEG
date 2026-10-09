// Server-side data the session runner needs besides the session itself:
// shared by the live session page and by the offline training pack
// (app/api/session-pack), so a workout run offline gets the same
// suggestions, last-time values and return-to-training rules.

import { db } from '@/lib/db';
import { getLastPerformances, type LastPerformance } from '@/lib/last-performance';
import { READINESS_RECENCY_HOURS, type ReadinessSignal } from '@/lib/progression';
import { isDeloadActive } from '@/lib/deload';
import { getReturnToTrainingRecommendations } from '@/lib/return-to-training-history';
import { pickableExerciseWhere } from '@/lib/catalog/access';
import type { ReturnRecommendation } from '@/lib/return-to-training';
import type { SerializedLastPerformance } from '@/components/session/session-runner';

// The workout shape the runner reads.
export const runnerWorkoutInclude = {
  program: {
    select: { id: true, name: true, cycleWeeks: true, cycleDeloadWeek: true, cycleAnchor: true },
  },
  exercises: {
    orderBy: { order: 'asc' },
    include: { exercise: true },
  },
} as const;

// Per-account context: same for every workout.
export async function loadRunnerProfile(userId: string, now: Date) {
  const [user, latestCheckin, catalog] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { unit: true, deloadUntil: true, bodyweight: true, activeGymId: true },
    }),
    db.readinessCheckin.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    // Catalog for the in-session exercise menu: only the fields it reads
    // (SessionCatalogExercise), not the whole row.
    db.exercise.findMany({
      where: pickableExerciseWhere(userId),
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        muscleGroup: true,
        category: true,
        usesBodyweight: true,
        defaultRestSec: true,
        equipmentType: true,
      },
    }),
  ]);
  return {
    unit: user?.unit ?? 'KG',
    bodyweight: user?.bodyweight ?? null,
    activeGymId: user?.activeGymId ?? null,
    // Planned deload week (issue #112): resolved against the clock here so the
    // client never reasons about dates; an expired deloadUntil has no effect.
    deloadActive: isDeloadActive(user?.deloadUntil ?? null, now),
    readiness: buildReadinessSignal(latestCheckin, now),
    catalog,
  };
}

// Per-workout context: last performance and return-to-training per exercise.
export async function loadWorkoutContext(
  userId: string,
  input: {
    programExercises: Parameters<typeof getReturnToTrainingRecommendations>[0]['programExercises'];
    excludeSessionId: string | null;
    now: Date;
    bodyweight: number | null;
    gym: Parameters<typeof getReturnToTrainingRecommendations>[0]['gym'];
  },
): Promise<{
  lastPerformances: Record<string, SerializedLastPerformance>;
  returnRecommendations: Record<string, ReturnRecommendation>;
}> {
  const exerciseIds = input.programExercises.map((pe) => pe.exerciseId);
  const [lastPerformances, returnRecommendations] = await Promise.all([
    getLastPerformances(userId, exerciseIds, input.excludeSessionId),
    getReturnToTrainingRecommendations({
      userId,
      programExercises: input.programExercises,
      excludeSessionId: input.excludeSessionId,
      now: input.now,
      bodyweight: input.bodyweight,
      gym: input.gym,
    }),
  ]);
  const serialized: Record<string, SerializedLastPerformance> = {};
  for (const [exerciseId, performance] of lastPerformances) {
    serialized[exerciseId] = serializePerf(performance);
  }
  return { lastPerformances: serialized, returnRecommendations };
}

// Turn the latest check-in into the readiness signal that drives the load
// suggestion. We only forward an in-window check-in; a stale one is dropped here
// so the client never has to reason about clocks (and the suggestion stays
// identical to the no-data path). Returns null when there is no usable signal.
function buildReadinessSignal(
  checkin: {
    readiness: number;
    soreness: unknown;
    createdAt: Date;
  } | null,
  now: Date,
): ReadinessSignal | null {
  if (!checkin) return null;
  const ageHours = (now.getTime() - checkin.createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours > READINESS_RECENCY_HOURS) return null;

  // soreness is stored as JSON; coerce defensively to a plain { group: 1-5 } map.
  let soreness: ReadinessSignal['soreness'] = null;
  if (
    checkin.soreness &&
    typeof checkin.soreness === 'object' &&
    !Array.isArray(checkin.soreness)
  ) {
    const entries = Object.entries(checkin.soreness as Record<string, unknown>).filter(
      ([, v]) => typeof v === 'number',
    ) as Array<[string, number]>;
    if (entries.length > 0) {
      soreness = Object.fromEntries(entries) as ReadinessSignal['soreness'];
    }
  }

  return { readiness: checkin.readiness, soreness, ageHours };
}

function serializePerf(p: LastPerformance): SerializedLastPerformance {
  return {
    sessionStartedAt: p.sessionStartedAt.toISOString(),
    sets: p.sets,
    maxWeight: p.maxWeight,
    repsAtMaxWeight: p.repsAtMaxWeight,
    cardio: p.cardio,
  };
}
