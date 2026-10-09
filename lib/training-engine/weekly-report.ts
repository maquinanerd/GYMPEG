// Deterministic weekly report (epic 2.6): what a training week added up to,
// against the week before, e.g. "4/4 workouts, 92 effective sets, 5 records;
// chest +12%, back +4%, quads -8%; best progress bench e1RM 91 -> 94 kg;
// average bodyweight 78.4 -> 78.0 kg". Every number comes from the engine;
// the AI may comment on the report later, never produce it.

import type { MuscleGroup } from '@/lib/prisma-client';
import { isoWeekKey } from '@/lib/stats';
import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';
import { calculateE1RM } from '@/lib/training-engine/records';
import {
  calculateMuscleVolume,
  isEffectiveSet,
  type MuscleContribution,
} from '@/lib/training-engine/volume';

export interface ReportSet {
  exerciseId: string;
  exerciseName: string;
  performedAt: Date;
  // Effective load in kg.
  weight: number;
  reps: number;
  rir?: number | null;
  rpe?: number | null;
  contributions: MuscleContribution[];
}

export interface WeeklyReport {
  weekKey: string;
  sessions: { done: number; planned: number | null };
  workingSets: number;
  effectiveSets: number;
  tonnageKg: number;
  records: number;
  // Effective sets per muscle this week, with the change on the week before
  // (null when the muscle was not trained then), biggest first.
  muscles: {
    group: MuscleGroup;
    effectiveSets: number;
    previous: number;
    changePct: number | null;
  }[];
  // The exercise whose best e1RM grew the most on the week before.
  bestProgress: { exerciseId: string; exerciseName: string; fromKg: number; toKg: number } | null;
  bodyweight: { averageKg: number; previousAverageKg: number | null } | null;
  guidelineVersion: string;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildWeeklyReport(input: {
  weekKey: string;
  previousWeekKey: string;
  // Working sets of the week and of the week before.
  sets: ReportSet[];
  sessionsDone: number;
  sessionsPlanned: number | null;
  records: number;
  bodyweightKg: { week: number[]; previousWeek: number[] };
  timeZone: string;
}): WeeklyReport {
  const weeks = calculateMuscleVolume(input.sets, { timeZone: input.timeZone });
  const thisWeek = weeks.find((week) => week.weekKey === input.weekKey)?.byMuscleGroup ?? {};
  const lastWeek =
    weeks.find((week) => week.weekKey === input.previousWeekKey)?.byMuscleGroup ?? {};

  const inWeek = (set: ReportSet) => isoWeekKey(set.performedAt, input.timeZone);
  const weekSets = input.sets.filter((set) => inWeek(set) === input.weekKey);
  const previousSets = input.sets.filter((set) => inWeek(set) === input.previousWeekKey);

  const muscles = (Object.entries(thisWeek) as [MuscleGroup, { effectiveSets: number }][])
    .map(([group, stats]) => {
      const previous = lastWeek[group]?.effectiveSets ?? 0;
      return {
        group,
        effectiveSets: stats.effectiveSets,
        previous,
        changePct:
          previous > 0 ? Math.round(((stats.effectiveSets - previous) / previous) * 100) : null,
      };
    })
    .filter((muscle) => muscle.effectiveSets > 0)
    .sort((a, b) => b.effectiveSets - a.effectiveSets || a.group.localeCompare(b.group));

  const bestE1RM = (sets: ReportSet[]) => {
    const best = new Map<string, { name: string; value: number }>();
    for (const set of sets) {
      const value = calculateE1RM(set.weight, set.reps);
      if (value == null) continue;
      const current = best.get(set.exerciseId);
      if (!current || value > current.value) {
        best.set(set.exerciseId, { name: set.exerciseName, value });
      }
    }
    return best;
  };
  const now = bestE1RM(weekSets);
  const before = bestE1RM(previousSets);
  let bestProgress: WeeklyReport['bestProgress'] = null;
  for (const [exerciseId, current] of now) {
    const previous = before.get(exerciseId);
    if (!previous || current.value <= previous.value) continue;
    const gain = current.value - previous.value;
    if (!bestProgress || gain > bestProgress.toKg - bestProgress.fromKg) {
      bestProgress = {
        exerciseId,
        exerciseName: current.name,
        fromKg: round1(previous.value),
        toKg: round1(current.value),
      };
    }
  }

  const mean = (values: number[]) =>
    values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const averageKg = mean(input.bodyweightKg.week);

  return {
    weekKey: input.weekKey,
    sessions: { done: input.sessionsDone, planned: input.sessionsPlanned },
    workingSets: weekSets.length,
    effectiveSets: weekSets.filter(isEffectiveSet).length,
    tonnageKg: round1(weekSets.reduce((sum, set) => sum + set.weight * set.reps, 0)),
    records: input.records,
    muscles,
    bestProgress,
    bodyweight:
      averageKg != null
        ? { averageKg, previousAverageKg: mean(input.bodyweightKg.previousWeek) }
        : null,
    guidelineVersion: TRAINING_GUIDELINE.version,
  };
}
