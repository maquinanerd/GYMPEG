// Manual exercise mapping of an import (G3): the lifter maps an imported name
// that matched nothing to one of their exercises in the preview. The rows are
// renamed to that exercise before planning, so duplicate detection, catalog
// resolution and execution all work on the chosen exercise as if the export
// had used its name. A mapped id the user cannot use is refused.

import { ApiError } from '@/lib/api';
import { suggestExercises, type ExerciseCandidate } from '@/lib/import/exercise-suggestions';

export function applyExerciseMapping<T extends { exerciseName: string }>(
  rows: T[],
  mapping: Record<string, string> | undefined,
  exercises: ExerciseCandidate[],
): T[] {
  const entries = Object.entries(mapping ?? {});
  if (entries.length === 0) return rows;
  const nameById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const targetByLower = new Map<string, string>();
  for (const [importedName, exerciseId] of entries) {
    const target = nameById.get(exerciseId);
    if (!target) throw new ApiError(400, 'An exercise chosen in the mapping is not available.');
    targetByLower.set(importedName.trim().toLowerCase(), target);
  }
  return rows.map((row) => {
    const target = targetByLower.get(row.exerciseName.trim().toLowerCase());
    return target ? { ...row, exerciseName: target } : row;
  });
}

// Up to three of the user's exercises for each imported name that matched
// nothing, for the preview's mapping choices.
export function mappingSuggestions(
  newExerciseNames: string[],
  exercises: ExerciseCandidate[],
): Record<string, ExerciseCandidate[]> {
  return Object.fromEntries(
    newExerciseNames.map((name) => [name, suggestExercises(name, exercises)]),
  );
}
