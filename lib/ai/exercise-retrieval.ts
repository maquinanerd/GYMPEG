// Exercise retrieval for the AI planner (G4, addendum 02 §9-10): instead of
// the whole catalog, the model gets a short list of candidates per muscle
// group that the lifter can actually do (equipment of the active gym, nothing
// they avoid), priority muscles first, preferred exercises first. The model
// can only pick from these ids.

import type {
  EquipmentType,
  ExerciseCategory,
  ExerciseLevel,
  MovementPattern,
  MuscleGroup,
} from '@/lib/prisma-client';
import { db } from '@/lib/db';
import { pickableExerciseWhere } from '@/lib/catalog/access';
import { catalogPtBrName } from '@/lib/catalog/search-index';
import { exerciseFitsEquipment } from '@/lib/ai/workout-plan';

export interface CatalogExerciseRow {
  id: string;
  name: string;
  userId: string | null;
  muscleGroup: MuscleGroup;
  category: ExerciseCategory;
  equipmentType: EquipmentType;
  equipmentTags: string[];
  movementPattern: MovementPattern | null;
  level: ExerciseLevel | null;
  muscles: { role: 'PRIMARY' | 'SECONDARY' | 'STABILIZER'; group: MuscleGroup }[];
}

export interface PlannerCandidate {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
  equipmentType: EquipmentType;
  movementPattern: MovementPattern | null;
  category: ExerciseCategory;
}

const LEVEL_RANK: Record<ExerciseLevel, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

export { exerciseFitsEquipment };

export function selectCandidates(
  exercises: CatalogExerciseRow[],
  options: {
    availableEquipment: string[];
    avoidedIds: ReadonlySet<string>;
    preferredIds: ReadonlySet<string>;
    priorityMuscles: MuscleGroup[];
    level?: ExerciseLevel | null;
    perGroup?: number;
    limit?: number;
  },
): PlannerCandidate[] {
  const perGroup = options.perGroup ?? 6;
  const limit = options.limit ?? 100;
  const userLevel = options.level ? LEVEL_RANK[options.level] : LEVEL_RANK.ADVANCED;
  const usable = exercises.filter(
    (exercise) =>
      exercise.category !== 'CARDIO' &&
      exercise.muscleGroup !== 'OTHER' &&
      !options.avoidedIds.has(exercise.id) &&
      exerciseFitsEquipment(exercise.equipmentTags, options.availableEquipment),
  );
  const groups = [...new Set(usable.map((exercise) => exercise.muscleGroup))].sort((a, b) => {
    const pa = options.priorityMuscles.includes(a) ? 0 : 1;
    const pb = options.priorityMuscles.includes(b) ? 0 : 1;
    return pa - pb || a.localeCompare(b);
  });
  const rank = (exercise: CatalogExerciseRow) => [
    options.preferredIds.has(exercise.id) ? 0 : 1,
    exercise.category === 'COMPOUND' ? 0 : 1,
    // Beyond the lifter's level only when nothing else fits.
    exercise.level && LEVEL_RANK[exercise.level] > userLevel ? 1 : 0,
    exercise.userId == null ? 0 : 1,
  ];
  const compare = (a: CatalogExerciseRow, b: CatalogExerciseRow) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i += 1) if (ra[i] !== rb[i]) return ra[i]! - rb[i]!;
    return a.name.localeCompare(b.name);
  };

  const picked: CatalogExerciseRow[] = [];
  for (const group of groups) {
    const quota = options.priorityMuscles.includes(group) ? perGroup + 2 : perGroup;
    picked.push(
      ...usable
        .filter((exercise) => exercise.muscleGroup === group)
        .sort(compare)
        .slice(0, quota),
    );
  }
  return picked.slice(0, limit).map((exercise) => ({
    id: exercise.id,
    name: catalogPtBrName(exercise.name) ?? exercise.name,
    primaryMuscles: [
      ...new Set([
        exercise.muscleGroup,
        ...exercise.muscles.filter((m) => m.role === 'PRIMARY').map((m) => m.group),
      ]),
    ],
    secondaryMuscles: [
      ...new Set(exercise.muscles.filter((m) => m.role === 'SECONDARY').map((m) => m.group)),
    ].filter((group) => group !== exercise.muscleGroup),
    equipment: exercise.equipmentTags,
    equipmentType: exercise.equipmentType,
    movementPattern: exercise.movementPattern,
    category: exercise.category,
  }));
}

// The lifter's pickable exercises with their muscles, for selectCandidates.
export async function loadCatalogForPlanner(userId: string): Promise<CatalogExerciseRow[]> {
  const rows = await db.exercise.findMany({
    where: pickableExerciseWhere(userId),
    select: {
      id: true,
      name: true,
      userId: true,
      muscleGroup: true,
      category: true,
      equipmentType: true,
      equipmentTags: true,
      movementPattern: true,
      level: true,
      muscles: { select: { role: true, muscle: { select: { group: true } } } },
    },
  });
  return rows.map((row) => ({
    ...row,
    muscles: row.muscles.map((m) => ({ role: m.role, group: m.muscle.group })),
  }));
}
