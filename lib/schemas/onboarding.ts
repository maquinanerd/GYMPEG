import { z } from 'zod';
import {
  MuscleGroup,
  Sex,
  TrainingExperience,
  TrainingGoal,
  WeightUnit,
} from '@/lib/prisma-client';

// Equipment a gym can have, in the catalog's equipment-tag vocabulary
// (data/catalog/exercises.json "equipment"). Bodyweight is always available
// and is not listed.
export const GYM_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'bench',
  'incline_bench',
  'rack',
  'smith_machine',
  'cable',
  'machine',
  'leg_press',
  'hack_squat',
  'leg_extension',
  'leg_curl',
  'pec_deck',
  'pull_up_bar',
  'dip_bars',
  'ez_bar',
  'kettlebell',
  'band',
  'cardio_machine',
] as const;
export type GymEquipmentTag = (typeof GYM_EQUIPMENT)[number];

export const TRAINING_TIMES = ['morning', 'afternoon', 'evening'] as const;

const MIN_AGE = 12;
const MAX_AGE = 100;

// YYYY-MM-DD, a real calendar date, for an age between MIN_AGE and MAX_AGE.
const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= MIN_AGE && age <= MAX_AGE;
  }, 'Invalid birth date');

// Onboarding answers (spec §4, AI addendum §2-6). Only the goal is required:
// the app must work without weight, height or anything else.
export const onboardingSchema = z.object({
  goal: z.nativeEnum(TrainingGoal),
  experience: z.nativeEnum(TrainingExperience).nullable().optional(),
  daysPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  // 0 = Sunday ... 6 = Saturday.
  trainingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  sessionMinutes: z.number().int().min(15).max(240).nullable().optional(),
  preferredTrainingTime: z.enum(TRAINING_TIMES).nullable().optional(),
  gym: z
    .object({
      name: z.string().trim().min(1).max(60),
      availableEquipment: z.array(z.enum(GYM_EQUIPMENT)).max(GYM_EQUIPMENT.length),
    })
    .optional(),
  priorityMuscles: z.array(z.nativeEnum(MuscleGroup)).max(6).optional(),
  avoidExerciseIds: z.array(z.string().min(1).max(64)).max(50).optional(),
  preferExerciseIds: z.array(z.string().min(1).max(64)).max(50).optional(),
  bodyweight: z.number().min(20).max(300).nullable().optional(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  birthDate: birthDateSchema.nullable().optional(),
  sex: z.nativeEnum(Sex).nullable().optional(),
  unit: z.nativeEnum(WeightUnit).optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
