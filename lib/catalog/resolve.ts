import type { Exercise, EquipmentType, ExerciseCategory, MuscleGroup } from '@/lib/prisma-client';
import type { db as dbClient } from '@/lib/db';
import { normalizeExerciseText } from '@/lib/catalog/catalog-schema';

// Prisma client or interactive-transaction client.
type Db = Pick<typeof dbClient, 'exercise' | 'exerciseAlias'>;

// Finds the exercise a free-text name refers to, for one user:
// 1. the user's own custom exercise with that name (case-insensitive);
// 2. a global catalog exercise with that name;
// 3. a global exercise whose alias, pt-BR name or legacy name matches
//    (accent- and case-insensitive).
// Imports, templates and the AI planner resolve names through here, so a name
// that already exists in the catalog never spawns a duplicate.
export async function findUsableExerciseByName(
  db: Db,
  userId: string,
  name: string,
): Promise<Exercise | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const own = await db.exercise.findFirst({
    where: { userId, name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (own) return own;

  const global = await db.exercise.findFirst({
    where: { userId: null, name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (global) return global;

  const normalized = normalizeExerciseText(trimmed);
  if (!normalized) return null;
  const alias = await db.exerciseAlias.findFirst({
    where: { normalized, exercise: { userId: null } },
    include: { exercise: true },
    orderBy: { isLegacy: 'desc' },
  });
  return alias?.exercise ?? null;
}

export interface NewCustomExercise {
  name: string;
  muscleGroup: MuscleGroup;
  category: ExerciseCategory;
  equipmentType?: EquipmentType;
  defaultRestSec?: number;
  usesBodyweight?: boolean;
  notes?: string | null;
}

// Resolves a name, or creates the user's custom exercise when nothing matches.
export async function ensureUsableExercise(
  db: Db,
  userId: string,
  data: NewCustomExercise,
): Promise<{ exercise: Exercise; created: boolean }> {
  const existing = await findUsableExerciseByName(db, userId, data.name);
  if (existing) return { exercise: existing, created: false };
  const exercise = await db.exercise.create({
    data: {
      userId,
      name: data.name.trim(),
      muscleGroup: data.muscleGroup,
      category: data.category,
      ...(data.equipmentType ? { equipmentType: data.equipmentType } : {}),
      ...(data.defaultRestSec ? { defaultRestSec: data.defaultRestSec } : {}),
      usesBodyweight: data.usesBodyweight ?? false,
      notes: data.notes ?? null,
      source: 'user',
    },
  });
  return { exercise, created: true };
}
