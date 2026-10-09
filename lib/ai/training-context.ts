// TrainingContextBuilder (G4, addendum 02 §7-8, §21-23): the lifter's data in
// the compact shape the AI planner reads, never the raw history. Every number
// here comes from the deterministic engine (body trend, capped e1RM, volume);
// the model interprets it, it never computes it.

import type { MuscleGroup } from '@/lib/prisma-client';
import { db } from '@/lib/db';
import { effectiveWeight } from '@/lib/stats';
import { safeTimeZone } from '@/lib/timezone';
import { calculateWeightTrend } from '@/lib/training-engine/body';
import { calculateE1RM } from '@/lib/training-engine/records';

export interface TrainingContext {
  profile: {
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    experience: string | null;
    goal: string | null;
    unit: string;
  };
  availability: {
    sessionsPerWeek: number | null;
    sessionMinutes: number | null;
    // ISO weekdays, 1 = Monday ... 7 = Sunday.
    trainingDays: number[];
  };
  // Equipment tags of the active gym; empty when unknown.
  equipment: string[];
  priorities: MuscleGroup[];
  avoidedExerciseIds: string[];
  preferredExerciseIds: string[];
  bodyweight: { weeklyAverageKg: number; change30DaysKg: number | null } | null;
  recentTraining: { sessionsLast30Days: number; averageMinutes: number | null };
  // Lifts trained most in the last 60 days, best estimated 1RM now vs before.
  performance: {
    exerciseId: string;
    name: string;
    e1rmPreviousKg: number | null;
    e1rmCurrentKg: number | null;
  }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildTrainingContext(
  userId: string,
  now = new Date(),
): Promise<TrainingContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      sex: true,
      heightCm: true,
      bodyweight: true,
      experience: true,
      goal: true,
      unit: true,
      weeklyFrequency: true,
      sessionMinutes: true,
      trainingDays: true,
      priorityMuscles: true,
      timezone: true,
      activeGymId: true,
      exercisePreferences: { select: { exerciseId: true, kind: true } },
    },
  });
  const timeZone = safeTimeZone(user?.timezone);
  const since60 = new Date(now.getTime() - 60 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [gym, weighIns, sessions, sets] = await Promise.all([
    user?.activeGymId
      ? db.gym.findFirst({
          where: { id: user.activeGymId, userId },
          select: { availableEquipment: true },
        })
      : null,
    db.bodyweightEntry.findMany({
      where: { userId, measuredAt: { gte: new Date(now.getTime() - 100 * DAY_MS) } },
      select: { weightKg: true, measuredAt: true },
    }),
    db.session.findMany({
      where: { userId, finishedAt: { not: null }, startedAt: { gte: since30 } },
      select: { startedAt: true, finishedAt: true },
    }),
    db.set.findMany({
      where: {
        isWarmup: false,
        durationSec: null,
        session: { userId, finishedAt: { not: null }, startedAt: { gte: since60 } },
      },
      select: {
        exerciseId: true,
        weight: true,
        reps: true,
        bodyweightKgSnapshot: true,
        session: { select: { startedAt: true } },
        exercise: { select: { name: true, usesBodyweight: true } },
      },
    }),
  ]);

  const trend = calculateWeightTrend(weighIns, { timeZone });
  const minutes = sessions
    .map((s) => (s.finishedAt!.getTime() - s.startedAt.getTime()) / 60_000)
    .filter((m) => m > 0 && m < 300);

  const byExercise = new Map<
    string,
    { name: string; count: number; previous: number | null; current: number | null }
  >();
  for (const set of sets) {
    const weight = effectiveWeight(
      set.weight,
      set.exercise.usesBodyweight,
      set.bodyweightKgSnapshot ?? user?.bodyweight,
    );
    const e1rm = calculateE1RM(weight, set.reps);
    const entry = byExercise.get(set.exerciseId) ?? {
      name: set.exercise.name,
      count: 0,
      previous: null,
      current: null,
    };
    entry.count += 1;
    if (e1rm != null) {
      const key = set.session.startedAt >= since30 ? 'current' : 'previous';
      entry[key] = Math.max(entry[key] ?? 0, e1rm);
    }
    byExercise.set(set.exerciseId, entry);
  }
  const round1 = (value: number | null) => (value == null ? null : Math.round(value * 10) / 10);

  return {
    profile: {
      sex: user?.sex ?? null,
      heightCm: user?.heightCm ?? null,
      weightKg: trend.averageKg ?? user?.bodyweight ?? null,
      experience: user?.experience ?? null,
      goal: user?.goal ?? null,
      unit: user?.unit ?? 'KG',
    },
    availability: {
      sessionsPerWeek: user?.weeklyFrequency ?? null,
      sessionMinutes: user?.sessionMinutes ?? null,
      // Stored with 0 = Sunday; the plan uses ISO weekdays.
      trainingDays: (user?.trainingDays ?? []).map((day) => (day === 0 ? 7 : day)).sort(),
    },
    equipment: gym?.availableEquipment ?? [],
    priorities: user?.priorityMuscles ?? [],
    avoidedExerciseIds: (user?.exercisePreferences ?? [])
      .filter((p) => p.kind === 'AVOID')
      .map((p) => p.exerciseId),
    preferredExerciseIds: (user?.exercisePreferences ?? [])
      .filter((p) => p.kind === 'PREFER')
      .map((p) => p.exerciseId),
    bodyweight:
      trend.averageKg != null
        ? { weeklyAverageKg: trend.averageKg, change30DaysKg: trend.changeKg.d30 }
        : null,
    recentTraining: {
      sessionsLast30Days: sessions.length,
      averageMinutes: minutes.length
        ? Math.round(minutes.reduce((sum, m) => sum + m, 0) / minutes.length)
        : null,
    },
    performance: [...byExercise.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([exerciseId, entry]) => ({
        exerciseId,
        name: entry.name,
        e1rmPreviousKg: round1(entry.previous),
        e1rmCurrentKg: round1(entry.current),
      })),
  };
}
