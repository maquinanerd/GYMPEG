import type { Prisma } from '@/lib/prisma-client';

// Who may see and use which exercise:
// - read / log / program: the global catalog (userId null) plus the user's own
//   custom exercises;
// - edit / delete: only the user's own custom exercises. Global rows are
//   read-only; personalizing one never rewrites it (spec §6).

export function usableExerciseWhere(userId: string): Prisma.ExerciseWhereInput {
  return { OR: [{ userId: null }, { userId }] };
}

// For pickers: same as usable, minus retired catalog rows (history still points
// at them, so they stay readable through usableExerciseWhere).
export function pickableExerciseWhere(userId: string): Prisma.ExerciseWhereInput {
  return { AND: [usableExerciseWhere(userId), { active: true }] };
}

export function ownedExerciseWhere(userId: string): Prisma.ExerciseWhereInput {
  return { userId };
}

export function isGlobalExercise(exercise: { userId: string | null }): boolean {
  return exercise.userId === null;
}
