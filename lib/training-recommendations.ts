// Persisted next-load decisions (ADR-007). When a session of a workout starts
// on the server (online, or when an offline start reaches it), the training
// engine decides each strength prescription line from that line's history,
// the gym's loads, the unit, the latest check-in and any planned deload, and
// the decision is stored with all of those inputs and the guideline version.
// The session screen runs the same pure engine on the same inputs, so what
// the lifter sees is what is recorded; the record is what an audit (or the
// AI coach) reads to explain a load.

import type { Prisma } from '@/lib/prisma-client';
import { db } from '@/lib/db';
import { isDeloadActive } from '@/lib/deload';
import { gymLoadConstraintsFor } from '@/lib/gym-loads';
import { getLastPerformances } from '@/lib/last-performance';
import { isDeloadWeek, programCycle } from '@/lib/program-cycle';
import { buildReadinessSignal } from '@/lib/session-runner-data';
import { recommendNextLoad } from '@/lib/training-engine/progression';

// Records the decisions for a session once (a replayed start records
// nothing). Returns how many were stored.
export async function recordSessionRecommendations(
  userId: string,
  sessionId: string,
  now: Date = new Date(),
): Promise<number> {
  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      workoutId: true,
      cycleWeek: true,
      program: { select: { cycleWeeks: true, cycleDeloadWeek: true, cycleAnchor: true } },
      gym: {
        select: {
          dumbbellWeights: true,
          plateWeights: true,
          barWeights: true,
          exerciseConfigs: {
            select: { exerciseId: true, isAvailable: true, weightOptions: true },
          },
        },
      },
      _count: { select: { recommendations: true } },
    },
  });
  if (!session?.workoutId || session._count.recommendations > 0) return 0;

  const [rows, user, checkin] = await Promise.all([
    db.programExercise.findMany({
      where: { workoutId: session.workoutId },
      orderBy: { order: 'asc' },
      include: { exercise: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { unit: true, deloadUntil: true } }),
    db.readinessCheckin.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ]);
  const strength = rows.filter((row) => row.exercise.category !== 'CARDIO');
  if (strength.length === 0) return 0;

  const history = await getLastPerformances(
    userId,
    strength.map((row) => row.exerciseId),
    session.id,
    { workoutId: session.workoutId },
  );
  const cycle = session.program ? programCycle(session.program) : null;
  const plannedDeload =
    isDeloadActive(user?.deloadUntil ?? null, now) ||
    (cycle != null && session.cycleWeek != null && isDeloadWeek(cycle, session.cycleWeek));
  const readiness = buildReadinessSignal(checkin, now);
  const unit = user?.unit ?? 'KG';

  const data = strength.map((row) => {
    const last = history.get(row.exerciseId);
    const decision = recommendNextLoad({
      prescription: row,
      exercise: row.exercise,
      lastSets: last?.sets ?? [],
      unit,
      readiness,
      plannedDeload,
      loadConstraints: gymLoadConstraintsFor(session.gym, row.exercise),
    });
    const inputs = {
      ...decision.inputs,
      history: last
        ? { sessionStartedAt: last.sessionStartedAt.toISOString(), sameWorkout: last.sameWorkout }
        : null,
    };
    return {
      userId,
      sessionId: session.id,
      programExerciseId: row.id,
      exerciseId: row.exerciseId,
      action: decision.action,
      valueKg: decision.valueKg,
      reason: decision.reason,
      inputs: inputs as Prisma.InputJsonValue,
      guidelineVersion: decision.guidelineVersion,
    };
  });
  await db.trainingRecommendation.createMany({ data });
  return data.length;
}
