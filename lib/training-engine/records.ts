// Personal records of a session (epic 2.2). Pure: given the working sets of
// one session and of every session before it, says what the session beat, with
// the previous best, so "Novo PR de e1RM no supino: 94 kg (antes 91)" needs no
// further lookup. Records:
// - per exercise: heaviest load, most reps at a load (or heavier), best
//   estimated 1RM (Epley, only up to TRAINING_GUIDELINE.e1rm.maxReps reps),
//   biggest single set (weight x reps) and biggest exercise volume in a session;
// - per session: biggest workout tonnage;
// - per week (the lifter's week): biggest weekly tonnage, recorded once, by the
//   session that pushes the week past every other week.
// A first time is a baseline, not a record: nothing is recorded without a
// previous value to beat. Ties are not records.
//
// Weights are effective loads in kg (bodyweight included for bodyweight
// exercises, by the caller); warm-ups and cardio are left out by the caller.

import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';

export type RecordType =
  | 'WEIGHT'
  | 'REPS'
  | 'E1RM'
  | 'SET_VOLUME'
  | 'EXERCISE_VOLUME'
  | 'WORKOUT_TONNAGE'
  | 'WEEKLY_TONNAGE';

export interface RecordSet {
  sessionId: string;
  exerciseId: string;
  // The lifter's week of the session (e.g. ISO "2026-W41" in their zone).
  weekKey: string;
  weight: number;
  reps: number;
}

export interface AchievedRecord {
  type: RecordType;
  // Null for the session and week records.
  exerciseId: string | null;
  value: number;
  previous: number;
  // The set behind a set-level record.
  weightKg?: number;
  reps?: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

// Estimated 1RM used for records, or null when the set has too many reps to
// say anything about a single (or no load at all).
export function calculateE1RM(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0 || reps > TRAINING_GUIDELINE.e1rm.maxReps) return null;
  return weight * (1 + reps / 30);
}

function sumBy<K>(sets: RecordSet[], key: (set: RecordSet) => K): Map<K, number> {
  const totals = new Map<K, number>();
  for (const set of sets) {
    totals.set(key(set), (totals.get(key(set)) ?? 0) + set.weight * set.reps);
  }
  return totals;
}

const maxOf = (values: Iterable<number>) => {
  let best: number | null = null;
  for (const value of values) if (best == null || value > best) best = value;
  return best;
};

function exerciseRecords(exerciseId: string, today: RecordSet[], before: RecordSet[]) {
  if (before.length === 0 || today.length === 0) return [];
  const records: AchievedRecord[] = [];

  const heaviestToday = today.reduce((best, set) => (set.weight > best.weight ? set : best));
  const heaviestBefore = maxOf(before.map((set) => set.weight))!;
  if (heaviestToday.weight > heaviestBefore) {
    records.push({
      type: 'WEIGHT',
      exerciseId,
      value: heaviestToday.weight,
      previous: heaviestBefore,
      weightKg: heaviestToday.weight,
      reps: heaviestToday.reps,
    });
  }

  // Most reps at a load, against earlier sets at that load or heavier; the
  // set with the biggest margin wins.
  let repsRecord: AchievedRecord | null = null;
  for (const set of today) {
    const atLeastAsHeavy = before.filter((prior) => prior.weight >= set.weight);
    const previous = maxOf(atLeastAsHeavy.map((prior) => prior.reps));
    if (previous == null || set.reps <= previous) continue;
    if (!repsRecord || set.reps - previous > repsRecord.value - repsRecord.previous) {
      repsRecord = {
        type: 'REPS',
        exerciseId,
        value: set.reps,
        previous,
        weightKg: set.weight,
        reps: set.reps,
      };
    }
  }
  if (repsRecord) records.push(repsRecord);

  const e1rm = (set: RecordSet) => calculateE1RM(set.weight, set.reps);
  const bestBefore = maxOf(before.map(e1rm).filter((value): value is number => value != null));
  const bestToday = today
    .map((set) => ({ set, value: e1rm(set) }))
    .filter((entry): entry is { set: RecordSet; value: number } => entry.value != null)
    .reduce<{ set: RecordSet; value: number } | null>(
      (best, entry) => (!best || entry.value > best.value ? entry : best),
      null,
    );
  if (bestBefore != null && bestToday && round1(bestToday.value) > round1(bestBefore)) {
    records.push({
      type: 'E1RM',
      exerciseId,
      value: round1(bestToday.value),
      previous: round1(bestBefore),
      weightKg: bestToday.set.weight,
      reps: bestToday.set.reps,
    });
  }

  const biggestSet = today.reduce((best, set) =>
    set.weight * set.reps > best.weight * best.reps ? set : best,
  );
  const biggestSetBefore = maxOf(before.map((set) => set.weight * set.reps))!;
  if (biggestSet.weight * biggestSet.reps > biggestSetBefore) {
    records.push({
      type: 'SET_VOLUME',
      exerciseId,
      value: round1(biggestSet.weight * biggestSet.reps),
      previous: round1(biggestSetBefore),
      weightKg: biggestSet.weight,
      reps: biggestSet.reps,
    });
  }

  const volumeToday = today.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const volumeBefore = maxOf(sumBy(before, (set) => set.sessionId).values())!;
  if (volumeToday > volumeBefore) {
    records.push({
      type: 'EXERCISE_VOLUME',
      exerciseId,
      value: round1(volumeToday),
      previous: round1(volumeBefore),
    });
  }
  return records;
}

export function detectSessionRecords(input: {
  sessionSets: RecordSet[];
  // Working sets of every earlier session.
  priorSets: RecordSet[];
}): AchievedRecord[] {
  const { sessionSets, priorSets } = input;
  if (sessionSets.length === 0) return [];
  const records: AchievedRecord[] = [];

  const exerciseIds = [...new Set(sessionSets.map((set) => set.exerciseId))].sort();
  for (const exerciseId of exerciseIds) {
    records.push(
      ...exerciseRecords(
        exerciseId,
        sessionSets.filter((set) => set.exerciseId === exerciseId),
        priorSets.filter((set) => set.exerciseId === exerciseId),
      ),
    );
  }

  const tonnage = sessionSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const tonnageBefore = maxOf(sumBy(priorSets, (set) => set.sessionId).values());
  if (tonnageBefore != null && tonnage > tonnageBefore) {
    records.push({
      type: 'WORKOUT_TONNAGE',
      exerciseId: null,
      value: round1(tonnage),
      previous: round1(tonnageBefore),
    });
  }

  // The week record goes to the session that lifts this week past every other.
  const week = sessionSets[0]!.weekKey;
  const weeks = sumBy(priorSets, (set) => set.weekKey);
  const weekSoFar = weeks.get(week) ?? 0;
  weeks.delete(week);
  const bestOtherWeek = maxOf(weeks.values());
  if (bestOtherWeek != null && weekSoFar <= bestOtherWeek && weekSoFar + tonnage > bestOtherWeek) {
    records.push({
      type: 'WEEKLY_TONNAGE',
      exerciseId: null,
      value: round1(weekSoFar + tonnage),
      previous: round1(bestOtherWeek),
    });
  }
  return records;
}
