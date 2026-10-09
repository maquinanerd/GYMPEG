// Exercises replaced only for one session (Session.exerciseSwaps): the
// machine is taken, a joint hurts today. A map of ProgramExercise id ->
// Exercise id; the saved program and its versions do not change. The row
// keeps its prescription (sets, reps, RIR, rest) and its place.

import { z } from 'zod';

export type ExerciseSwaps = Record<string, string>;

const MAX_SWAPS = 50;

export const exerciseSwapsSchema = z
  .record(z.string().min(1).max(64), z.string().min(1).max(64))
  .refine((swaps) => Object.keys(swaps).length <= MAX_SWAPS, 'Too many replaced exercises.');

// Reads the stored JSON defensively: anything malformed means no swaps.
export function parseExerciseSwaps(value: unknown): ExerciseSwaps {
  const parsed = exerciseSwapsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

// The session's rows with the replaced exercises in place. An entry whose
// exercise is unknown (deleted meanwhile) or equal to the row's own is
// ignored.
export function applyExerciseSwaps<
  E extends { id: string },
  T extends { id: string; exerciseId: string; exercise: E },
>(rows: T[], swaps: ExerciseSwaps, exercises: ReadonlyMap<string, E>): T[] {
  return rows.map((row) => {
    const exerciseId = swaps[row.id];
    const exercise = exerciseId && exerciseId !== row.exerciseId ? exercises.get(exerciseId) : null;
    return exercise ? { ...row, exerciseId: exercise.id, exercise } : row;
  });
}
