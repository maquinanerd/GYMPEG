// The AI workout plan (G4, addendum 02 §13-16): the only shape the model may
// answer with, and the domain validation every plan goes through before the
// lifter even sees it. The model names exercises by exerciseId only; the
// backend checks each id against the candidates it offered, the gym, the
// exercises the lifter avoids and sane training values, and computes the
// program analysis itself (durations, weekly sets per muscle, coverage).

import { z } from 'zod';
import type { MuscleGroup } from '@/lib/prisma-client';
import type { PlannerCandidate } from '@/lib/ai/exercise-retrieval';

// Pure module (no database): the preview runs the same validation in the
// browser while the lifter edits the plan.

// What the validation needs to know about an exercise.
export type PlanCandidate = Pick<PlannerCandidate, 'id' | 'name' | 'primaryMuscles' | 'equipment'>;

// With no equipment list the gym is unknown: nothing is ruled out. Otherwise
// every tag the exercise needs must be there.
export function exerciseFitsEquipment(tags: string[], available: string[]): boolean {
  if (available.length === 0) return true;
  const have = new Set(available);
  return tags.every((tag) => have.has(tag));
}

export const aiPlannedExerciseSchema = z.object({
  exerciseId: z.string().min(1).max(64),
  order: z.number().int().min(1).max(20),
  sets: z.number().int(),
  repMin: z.number().int(),
  repMax: z.number().int(),
  targetRir: z.number().nullable(),
  targetRpe: z.number().nullable(),
  restSeconds: z.number().int(),
  notes: z.string().max(300).optional(),
});

export const aiWorkoutPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  rationale: z.string().trim().max(2000),
  daysPerWeek: z.number().int().min(1).max(7),
  workouts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        dayOfWeek: z.number().int().min(1).max(7).nullable().optional(),
        estimatedDurationMinutes: z.number().min(0).max(300),
        exercises: z.array(aiPlannedExerciseSchema).min(1).max(12),
      }),
    )
    .min(1)
    .max(7),
});

export type AiWorkoutPlan = z.infer<typeof aiWorkoutPlanSchema>;

// Parses the model's text: a bare JSON object, possibly wrapped in a code
// fence by a model that ignored the instruction.
export function parseAiWorkoutPlan(
  text: string,
): { ok: true; plan: AiWorkoutPlan } | { ok: false; error: string } {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'The answer is not valid JSON.' };
  }
  const result = aiWorkoutPlanSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: `${issue?.path.join('.') || 'plan'}: ${issue?.message ?? 'invalid'}`,
    };
  }
  return { ok: true, plan: result.data };
}

export type PlanIssueCode =
  | 'UNKNOWN_EXERCISE'
  | 'AVOIDED_EXERCISE'
  | 'EQUIPMENT_MISSING'
  | 'DUPLICATE_EXERCISE'
  | 'SETS_OUT_OF_RANGE'
  | 'REPS_OUT_OF_RANGE'
  | 'RIR_OUT_OF_RANGE'
  | 'RPE_OUT_OF_RANGE'
  | 'REST_OUT_OF_RANGE'
  | 'DAYS_MISMATCH'
  | 'SESSIONS_DIFFER_FROM_AVAILABILITY'
  | 'TOO_LONG'
  | 'VOLUME_TOO_HIGH'
  | 'MUSCLE_NOT_COVERED';

export interface PlanIssue {
  code: PlanIssueCode;
  path: string;
  message: string;
}

export interface PlanAnalysis {
  // Domain estimate per workout, never the model's.
  estimatedMinutes: number[];
  weeklySetsByMuscle: Partial<Record<MuscleGroup, number>>;
  missingMajorGroups: string[];
}

export interface PlanValidation {
  ok: boolean;
  errors: PlanIssue[];
  warnings: PlanIssue[];
  analysis: PlanAnalysis;
}

export const PLAN_LIMITS = {
  sets: [1, 10],
  reps: [1, 30],
  rir: [0, 5],
  rpe: [6, 10],
  rest: [30, 600],
  weeklySetsPerMuscle: 25,
  durationTolerance: 1.15,
} as const;

// Major groups a whole-body week is expected to train, with the muscle groups
// that count for each.
const MAJOR_GROUPS: Record<string, MuscleGroup[]> = {
  chest: ['CHEST'],
  back: ['BACK_WIDTH', 'BACK_THICKNESS'],
  shoulders: ['SHOULDERS_FRONT', 'SHOULDERS_LATERAL', 'SHOULDERS_REAR'],
  quads: ['QUADS'],
  posteriorChain: ['HAMSTRINGS', 'GLUTES', 'LOWER_BACK'],
};

// Minutes of one workout: a short warm-up plus, per set, the time under load
// (about 3 s per rep) and the rest that follows it.
export function estimateWorkoutMinutes(
  exercises: { sets: number; repMin: number; repMax: number; restSeconds: number }[],
): number {
  const seconds = exercises.reduce((sum, exercise) => {
    const reps = (exercise.repMin + exercise.repMax) / 2;
    return sum + exercise.sets * (reps * 3 + exercise.restSeconds);
  }, 0);
  return Math.round(5 + seconds / 60);
}

const inRange = (value: number, [min, max]: readonly [number, number]) =>
  value >= min && value <= max;

export function validateWorkoutPlan(
  plan: AiWorkoutPlan,
  context: {
    candidates: ReadonlyMap<string, PlanCandidate>;
    availableEquipment: string[];
    avoidedIds: ReadonlySet<string>;
    sessionsPerWeek: number | null;
    sessionMinutes: number | null;
  },
): PlanValidation {
  const errors: PlanIssue[] = [];
  const warnings: PlanIssue[] = [];
  const weeklySetsByMuscle: Partial<Record<MuscleGroup, number>> = {};
  const estimatedMinutes: number[] = [];

  if (plan.workouts.length !== plan.daysPerWeek) {
    errors.push({
      code: 'DAYS_MISMATCH',
      path: 'workouts',
      message: `${plan.workouts.length} workouts for ${plan.daysPerWeek} days per week.`,
    });
  }
  if (context.sessionsPerWeek != null && plan.workouts.length !== context.sessionsPerWeek) {
    warnings.push({
      code: 'SESSIONS_DIFFER_FROM_AVAILABILITY',
      path: 'workouts',
      message: `${plan.workouts.length} workouts; the lifter trains ${context.sessionsPerWeek} times a week.`,
    });
  }

  plan.workouts.forEach((workout, w) => {
    const seen = new Set<string>();
    workout.exercises.forEach((exercise, e) => {
      const path = `workouts.${w}.exercises.${e}`;
      const candidate = context.candidates.get(exercise.exerciseId);
      if (!candidate) {
        errors.push({
          code: 'UNKNOWN_EXERCISE',
          path: `${path}.exerciseId`,
          message: `Exercise ${exercise.exerciseId} was not offered.`,
        });
      } else {
        if (context.avoidedIds.has(candidate.id)) {
          errors.push({
            code: 'AVOIDED_EXERCISE',
            path: `${path}.exerciseId`,
            message: `${candidate.name} is avoided.`,
          });
        }
        if (!exerciseFitsEquipment(candidate.equipment, context.availableEquipment)) {
          errors.push({
            code: 'EQUIPMENT_MISSING',
            path: `${path}.exerciseId`,
            message: `${candidate.name} needs equipment the gym does not have.`,
          });
        }
        for (const group of candidate.primaryMuscles) {
          weeklySetsByMuscle[group] = (weeklySetsByMuscle[group] ?? 0) + exercise.sets;
        }
      }
      if (seen.has(exercise.exerciseId)) {
        errors.push({
          code: 'DUPLICATE_EXERCISE',
          path: `${path}.exerciseId`,
          message: 'The same exercise twice in one workout.',
        });
      }
      seen.add(exercise.exerciseId);
      if (!inRange(exercise.sets, PLAN_LIMITS.sets)) {
        errors.push({
          code: 'SETS_OUT_OF_RANGE',
          path: `${path}.sets`,
          message: 'Sets out of range.',
        });
      }
      if (
        !inRange(exercise.repMin, PLAN_LIMITS.reps) ||
        !inRange(exercise.repMax, PLAN_LIMITS.reps) ||
        exercise.repMin > exercise.repMax
      ) {
        errors.push({
          code: 'REPS_OUT_OF_RANGE',
          path: `${path}.repMin`,
          message: 'Reps out of range.',
        });
      }
      if (exercise.targetRir != null && !inRange(exercise.targetRir, PLAN_LIMITS.rir)) {
        errors.push({
          code: 'RIR_OUT_OF_RANGE',
          path: `${path}.targetRir`,
          message: 'RIR out of range.',
        });
      }
      if (exercise.targetRpe != null && !inRange(exercise.targetRpe, PLAN_LIMITS.rpe)) {
        errors.push({
          code: 'RPE_OUT_OF_RANGE',
          path: `${path}.targetRpe`,
          message: 'RPE out of range.',
        });
      }
      if (!inRange(exercise.restSeconds, PLAN_LIMITS.rest)) {
        errors.push({
          code: 'REST_OUT_OF_RANGE',
          path: `${path}.restSeconds`,
          message: 'Rest out of range.',
        });
      }
    });

    const minutes = estimateWorkoutMinutes(workout.exercises);
    estimatedMinutes.push(minutes);
    if (
      context.sessionMinutes != null &&
      minutes > context.sessionMinutes * PLAN_LIMITS.durationTolerance
    ) {
      warnings.push({
        code: 'TOO_LONG',
        path: `workouts.${w}`,
        message: `About ${minutes} min for a ${context.sessionMinutes} min session.`,
      });
    }
  });

  for (const [group, sets] of Object.entries(weeklySetsByMuscle)) {
    if (sets > PLAN_LIMITS.weeklySetsPerMuscle) {
      warnings.push({
        code: 'VOLUME_TOO_HIGH',
        path: 'workouts',
        message: `${sets} weekly sets for ${group}.`,
      });
    }
  }
  const missingMajorGroups =
    plan.daysPerWeek >= 2
      ? Object.entries(MAJOR_GROUPS)
          .filter(([, groups]) => groups.every((group) => !weeklySetsByMuscle[group]))
          .map(([name]) => name)
      : [];
  for (const name of missingMajorGroups) {
    warnings.push({
      code: 'MUSCLE_NOT_COVERED',
      path: 'workouts',
      message: `No work for ${name}.`,
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    analysis: { estimatedMinutes, weeklySetsByMuscle, missingMajorGroups },
  };
}
