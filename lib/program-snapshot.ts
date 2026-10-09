// Program snapshots (ProgramRevision.snapshot): the structure of a program at
// one point in time, and the difference between two of them. Pure functions;
// the database side lives in lib/program-revisions.

import { z } from 'zod';
import type { ProgramSchedule, SetAutoregulationMode } from '@/lib/prisma-client';

const snapshotExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  // Kept so an old version stays readable after the exercise is renamed,
  // merged into the catalog or deleted.
  exerciseName: z.string(),
  order: z.number(),
  targetSets: z.number(),
  targetRepsMin: z.number(),
  targetRepsMax: z.number(),
  targetRIR: z.number(),
  restSec: z.number(),
  tempo: z.string().nullable(),
  notes: z.string().nullable(),
  supersetGroup: z.number().nullable(),
  autoregulationMode: z.enum(['PRESERVE_RIR', 'PRESERVE_REPS']),
  fatigueRate: z.number().nullable(),
  loadAdjustmentPct: z.number().nullable(),
});

const snapshotWorkoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  dayOfWeek: z.number().nullable(),
  order: z.number(),
  exercises: z.array(snapshotExerciseSchema),
});

export const programSnapshotSchema = z.object({
  format: z.literal(1),
  name: z.string(),
  description: z.string().nullable(),
  phase: z.string(),
  // Absent in versions recorded before schedules existed: a rotation.
  scheduleMode: z.enum(['ROTATION', 'FIXED_DAYS']).default('ROTATION'),
  // Mesocycle; absent in versions recorded before cycles existed: none.
  cycleWeeks: z.number().nullable().default(null),
  cycleDeloadWeek: z.number().nullable().default(null),
  workouts: z.array(snapshotWorkoutSchema),
});

export type ProgramSnapshot = z.infer<typeof programSnapshotSchema>;
export type SnapshotWorkout = ProgramSnapshot['workouts'][number];
export type SnapshotExercise = SnapshotWorkout['exercises'][number];

// The shape lib/program-revisions loads (Prisma rows with the exercise name).
export interface ProgramForSnapshot {
  name: string;
  description: string | null;
  phase: string;
  scheduleMode: ProgramSchedule;
  cycleWeeks: number | null;
  cycleDeloadWeek: number | null;
  workouts: Array<{
    id: string;
    name: string;
    dayOfWeek: number | null;
    order: number;
    exercises: Array<{
      id: string;
      exerciseId: string;
      exercise: { name: string };
      order: number;
      targetSets: number;
      targetRepsMin: number;
      targetRepsMax: number;
      targetRIR: number;
      restSec: number;
      tempo: string | null;
      notes: string | null;
      supersetGroup: number | null;
      autoregulationMode: SetAutoregulationMode;
      fatigueRate: number | null;
      loadAdjustmentPct: number | null;
    }>;
  }>;
}

export function buildProgramSnapshot(program: ProgramForSnapshot): ProgramSnapshot {
  return {
    format: 1,
    name: program.name,
    description: program.description,
    phase: program.phase,
    scheduleMode: program.scheduleMode,
    cycleWeeks: program.cycleWeeks,
    cycleDeloadWeek: program.cycleWeeks ? program.cycleDeloadWeek : null,
    workouts: [...program.workouts]
      .sort((a, b) => a.order - b.order)
      .map((workout) => ({
        id: workout.id,
        name: workout.name,
        dayOfWeek: workout.dayOfWeek,
        order: workout.order,
        exercises: [...workout.exercises]
          .sort((a, b) => a.order - b.order)
          .map((pe) => ({
            id: pe.id,
            exerciseId: pe.exerciseId,
            exerciseName: pe.exercise.name,
            order: pe.order,
            targetSets: pe.targetSets,
            targetRepsMin: pe.targetRepsMin,
            targetRepsMax: pe.targetRepsMax,
            targetRIR: pe.targetRIR,
            restSec: pe.restSec,
            tempo: pe.tempo,
            notes: pe.notes,
            supersetGroup: pe.supersetGroup,
            autoregulationMode: pe.autoregulationMode,
            fatigueRate: pe.fatigueRate,
            loadAdjustmentPct: pe.loadAdjustmentPct,
          })),
      })),
  };
}

// What makes two versions "the same program": everything but row ids and
// display names, in a canonical JSON form (sorted keys, so a snapshot read
// back from JSONB hashes like the one that was written).
export function snapshotContent(snapshot: ProgramSnapshot): string {
  return canonicalJson({
    name: snapshot.name,
    description: snapshot.description,
    phase: snapshot.phase,
    // Only when not the default, so programs recorded before schedules
    // existed keep their content hash.
    ...(snapshot.scheduleMode !== 'ROTATION' ? { scheduleMode: snapshot.scheduleMode } : {}),
    ...(snapshot.cycleWeeks
      ? { cycleWeeks: snapshot.cycleWeeks, cycleDeloadWeek: snapshot.cycleDeloadWeek }
      : {}),
    workouts: snapshot.workouts.map((workout) => ({
      name: workout.name,
      dayOfWeek: workout.dayOfWeek,
      order: workout.order,
      exercises: workout.exercises.map(
        ({ id: _id, exerciseName: _name, ...prescription }) => prescription,
      ),
    })),
  });
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export type FieldValue = string | number | null;

export interface FieldChange {
  field: string;
  from: FieldValue;
  to: FieldValue;
}

export interface ExerciseChange {
  name: string;
  // Set when the prescription now points to another exercise.
  previousName?: string;
  fields: FieldChange[];
}

export interface WorkoutChange {
  name: string;
  previousName?: string;
  fields: FieldChange[];
  exercisesAdded: string[];
  exercisesRemoved: string[];
  exercisesChanged: ExerciseChange[];
  reordered: boolean;
}

export interface ProgramDiff {
  fields: FieldChange[];
  workoutsAdded: Array<{ name: string; exercises: string[] }>;
  workoutsRemoved: string[];
  workoutsChanged: WorkoutChange[];
}

const PROGRAM_FIELDS = [
  'name',
  'description',
  'phase',
  'scheduleMode',
  'cycleWeeks',
  'cycleDeloadWeek',
] as const;
const WORKOUT_FIELDS = ['dayOfWeek'] as const;
const EXERCISE_FIELDS = [
  'targetSets',
  'targetRepsMin',
  'targetRepsMax',
  'targetRIR',
  'restSec',
  'tempo',
  'notes',
  'supersetGroup',
  'autoregulationMode',
  'fatigueRate',
  'loadAdjustmentPct',
] as const;

function changedFields<T extends object>(
  from: T,
  to: T,
  fields: readonly (keyof T & string)[],
): FieldChange[] {
  return fields
    .filter((field) => from[field] !== to[field])
    .map((field) => ({
      field,
      from: from[field] as FieldValue,
      to: to[field] as FieldValue,
    }));
}

// Pairs rows of two versions: same row id first (the usual case: an edit
// keeps ids), then the same key (a row deleted and re-created, or restored).
function pair<T extends { id: string }>(
  from: T[],
  to: T[],
  key: (item: T) => string,
): { pairs: Array<[T, T]>; added: T[]; removed: T[] } {
  const pairs: Array<[T, T]> = [];
  const unmatched = new Set(from);
  const added: T[] = [];
  for (const item of to) {
    const byId = from.find((candidate) => candidate.id === item.id && unmatched.has(candidate));
    const match =
      byId ?? from.find((candidate) => unmatched.has(candidate) && key(candidate) === key(item));
    if (match) {
      unmatched.delete(match);
      pairs.push([match, item]);
    } else {
      added.push(item);
    }
  }
  return { pairs, added, removed: [...unmatched] };
}

// Same exercise when the id matches, or when only the id changed (the user's
// copy merged into the catalog keeps its name).
function sameExercise(a: SnapshotExercise, b: SnapshotExercise): boolean {
  return (
    a.exerciseId === b.exerciseId ||
    a.exerciseName.trim().toLowerCase() === b.exerciseName.trim().toLowerCase()
  );
}

// What changes when going from `from` to `to`.
export function diffProgramSnapshots(from: ProgramSnapshot, to: ProgramSnapshot): ProgramDiff {
  const workouts = pair(from.workouts, to.workouts, (workout) => workout.name.trim().toLowerCase());

  const workoutsChanged: WorkoutChange[] = [];
  for (const [before, after] of workouts.pairs) {
    const exercises = pair(before.exercises, after.exercises, (pe) => pe.exerciseId);
    const exercisesChanged: ExerciseChange[] = [];
    for (const [a, b] of exercises.pairs) {
      const fields = changedFields(a, b, EXERCISE_FIELDS);
      const swapped = !sameExercise(a, b);
      if (fields.length > 0 || swapped) {
        exercisesChanged.push({
          name: b.exerciseName,
          ...(swapped ? { previousName: a.exerciseName } : {}),
          fields,
        });
      }
    }
    const beforeOrder = exercises.pairs
      .map(([a]) => a)
      .sort((x, y) => x.order - y.order)
      .map((pe) => pe.id);
    const afterOrder = exercises.pairs
      .map(([a, b]) => ({ id: a.id, order: b.order }))
      .sort((x, y) => x.order - y.order)
      .map((pe) => pe.id);
    const reordered = beforeOrder.join() !== afterOrder.join();
    const fields = changedFields(before, after, WORKOUT_FIELDS);
    const renamed = before.name !== after.name;

    if (
      renamed ||
      fields.length > 0 ||
      exercises.added.length > 0 ||
      exercises.removed.length > 0 ||
      exercisesChanged.length > 0 ||
      reordered
    ) {
      workoutsChanged.push({
        name: after.name,
        ...(renamed ? { previousName: before.name } : {}),
        fields,
        exercisesAdded: exercises.added.map((pe) => pe.exerciseName),
        exercisesRemoved: exercises.removed.map((pe) => pe.exerciseName),
        exercisesChanged,
        reordered,
      });
    }
  }

  return {
    fields: changedFields(from, to, PROGRAM_FIELDS),
    workoutsAdded: workouts.added.map((workout) => ({
      name: workout.name,
      exercises: workout.exercises.map((pe) => pe.exerciseName),
    })),
    workoutsRemoved: workouts.removed.map((workout) => workout.name),
    workoutsChanged,
  };
}

export function isEmptyDiff(diff: ProgramDiff): boolean {
  return (
    diff.fields.length === 0 &&
    diff.workoutsAdded.length === 0 &&
    diff.workoutsRemoved.length === 0 &&
    diff.workoutsChanged.length === 0
  );
}
