import { z } from 'zod';
import { EquipmentType, ExerciseCategory, MuscleGroup } from '@/lib/prisma-client';

// Shape of data/catalog/*.json, the curated global exercise catalog (ADR-005).
// Validated on load: a malformed catalog must fail the sync loudly rather than
// write half a catalog.

export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'knee_flexion',
  'knee_extension',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_abduction',
  'calf',
  'core',
  'carry',
  'isolation',
  'cardio',
] as const;

export const catalogMuscleSchema = z.object({
  slug: z.string().regex(/^[a-z_]+$/),
  nameEn: z.string().min(1),
  namePtBr: z.string().min(1),
  group: z.nativeEnum(MuscleGroup),
  view: z.enum(['front', 'back']),
});

export const catalogExerciseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(120),
  namePtBr: z.string().min(1).max(120),
  aliases: z.object({ pt: z.array(z.string().min(1)), en: z.array(z.string().min(1)) }),
  legacyNames: z.array(z.string().min(1)),
  category: z.nativeEnum(ExerciseCategory),
  equipmentType: z.nativeEnum(EquipmentType),
  equipment: z.array(z.string().min(1)),
  movementPattern: z.enum(MOVEMENT_PATTERNS),
  muscleGroup: z.nativeEnum(MuscleGroup),
  muscles: z.object({
    primary: z.array(z.string()).min(1),
    secondary: z.array(z.string()),
  }),
  laterality: z.enum(['BILATERAL', 'UNILATERAL', 'ALTERNATING']),
  usesBodyweight: z.boolean(),
  defaultRestSec: z.number().int().min(30).max(300),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  instructionsPtBr: z.array(z.string().min(1)).min(3).max(5),
  commonMistakesPtBr: z.array(z.string().min(1)).max(5),
  source: z.string().min(1),
  sourceRef: z.string().nullable(),
  sourceLicense: z.string().min(1),
  reviewStatus: z.enum(['draft', 'reviewed']),
  priority: z.enum(['P0', 'P1']),
});

export const catalogFileSchema = z.object({
  version: z.number().int().positive(),
  exercises: z.array(catalogExerciseSchema),
});

export type CatalogMuscle = z.infer<typeof catalogMuscleSchema>;
export type CatalogExerciseEntry = z.infer<typeof catalogExerciseSchema>;
export type CatalogFile = z.infer<typeof catalogFileSchema>;

// Lower-case, accent-free, single-spaced: what search and name matching
// compare. "Supino Reto  com Barra" and "supino reto com barra" are equal.
export function normalizeExerciseText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
