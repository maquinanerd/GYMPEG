// Volume, frequency and adherence (epic 2.3). Pure functions over working
// sets and the plan:
// - each set counts for the exercise's primary muscles and, by a share, for
//   the secondary ones (catalog ExerciseMuscle roles; an exercise without them
//   counts for its own muscle group only);
// - "effective" sets are the hard ones (RIR <= 4 or RPE >= 6; unrated sets
//   count), the measure the MEV/MRV landmarks are about;
// - frequency is the number of distinct days in the lifter's week a muscle
//   got any work;
// - adherence compares the sessions and prescribed sets of the plan with what
//   was done.

import type { MuscleGroup } from '@/lib/prisma-client';
import { isoWeekKey, isoWeekStart } from '@/lib/stats';
import { localDayKey } from '@/lib/timezone';
import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';

export type ContributionRole = 'PRIMARY' | 'SECONDARY';

export interface MuscleContribution {
  group: MuscleGroup;
  share: number;
}

// Muscle groups a set of this exercise works, with the share of the set each
// gets. The exercise's own group is always primary; catalog roles add the
// rest, the strongest role winning when two muscles share a group.
export function muscleContributions(exercise: {
  muscleGroup: MuscleGroup;
  muscles?: { role: 'PRIMARY' | 'SECONDARY' | 'STABILIZER'; group: MuscleGroup }[];
}): MuscleContribution[] {
  const shares = new Map<MuscleGroup, number>([[exercise.muscleGroup, 1]]);
  for (const muscle of exercise.muscles ?? []) {
    const share =
      muscle.role === 'PRIMARY'
        ? 1
        : muscle.role === 'SECONDARY'
          ? TRAINING_GUIDELINE.secondarySetShare
          : 0;
    if (share > (shares.get(muscle.group) ?? 0)) shares.set(muscle.group, share);
  }
  shares.delete('OTHER');
  return [...shares.entries()].map(([group, share]) => ({ group, share }));
}

export function isEffectiveSet(set: { rir?: number | null; rpe?: number | null }): boolean {
  if (set.rir != null) return set.rir <= TRAINING_GUIDELINE.effectiveSetMaxRIR;
  if (set.rpe != null) return set.rpe >= TRAINING_GUIDELINE.effectiveSetMinRPE;
  return true;
}

export interface MuscleWeekStats {
  // Working sets, weighted by the muscle's share.
  sets: number;
  // The effective ones among them.
  effectiveSets: number;
  // Load x reps, weighted by the share (kg).
  volumeKg: number;
  // Distinct days with any work for the muscle.
  days: number;
}

export interface MuscleVolumeWeek {
  weekKey: string;
  weekStart: Date;
  byMuscleGroup: Partial<Record<MuscleGroup, MuscleWeekStats>>;
}

export interface VolumeSet {
  // Effective load in kg (bodyweight applied by the caller).
  weight: number;
  reps: number;
  rir?: number | null;
  rpe?: number | null;
  performedAt: Date;
  contributions: MuscleContribution[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

// Working (non-warmup, non-cardio) sets in, one entry per lifter week out,
// oldest first.
export function calculateMuscleVolume(
  sets: VolumeSet[],
  options: { timeZone?: string } = {},
): MuscleVolumeWeek[] {
  const timeZone = options.timeZone ?? 'UTC';
  const weeks = new Map<
    string,
    { weekStart: Date; groups: Map<MuscleGroup, MuscleWeekStats & { dayKeys: Set<string> }> }
  >();
  for (const set of sets) {
    const key = isoWeekKey(set.performedAt, timeZone);
    let week = weeks.get(key);
    if (!week) {
      week = { weekStart: isoWeekStart(set.performedAt, timeZone), groups: new Map() };
      weeks.set(key, week);
    }
    const day = localDayKey(set.performedAt, timeZone);
    const effective = isEffectiveSet(set);
    for (const { group, share } of set.contributions) {
      if (share <= 0) continue;
      let stats = week.groups.get(group);
      if (!stats) {
        stats = { sets: 0, effectiveSets: 0, volumeKg: 0, days: 0, dayKeys: new Set() };
        week.groups.set(group, stats);
      }
      stats.sets += share;
      if (effective) stats.effectiveSets += share;
      stats.volumeKg += share * set.weight * set.reps;
      stats.dayKeys.add(day);
    }
  }
  return [...weeks.entries()]
    .map(([weekKey, week]) => ({
      weekKey,
      weekStart: week.weekStart,
      byMuscleGroup: Object.fromEntries(
        [...week.groups.entries()].map(([group, stats]) => [
          group,
          {
            sets: round1(stats.sets),
            effectiveSets: round1(stats.effectiveSets),
            volumeKg: round1(stats.volumeKg),
            days: stats.dayKeys.size,
          },
        ]),
      ) as MuscleVolumeWeek['byMuscleGroup'],
    }))
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

export interface Adherence {
  sessionsDone: number;
  sessionsPlanned: number;
  // Working sets done in those sessions against what their workouts prescribed.
  setsDone: number;
  setsPrescribed: number;
  // 0..1, capped at 1 (doing more than planned is not "more adherent").
  sessionRatio: number;
  setRatio: number;
}

export function calculateAdherence(input: {
  sessionsPlanned: number;
  sessions: { prescribedSets: number; workingSets: number }[];
}): Adherence {
  const setsPrescribed = input.sessions.reduce((sum, session) => sum + session.prescribedSets, 0);
  // Extra sets in one session do not make up for a short one.
  const setsDone = input.sessions.reduce(
    (sum, session) => sum + Math.min(session.workingSets, session.prescribedSets),
    0,
  );
  const ratio = (done: number, planned: number) =>
    planned > 0 ? Math.min(1, Math.round((done / planned) * 100) / 100) : 0;
  return {
    sessionsDone: input.sessions.length,
    sessionsPlanned: input.sessionsPlanned,
    setsDone,
    setsPrescribed,
    sessionRatio: ratio(input.sessions.length, input.sessionsPlanned),
    setRatio: ratio(setsDone, setsPrescribed),
  };
}
