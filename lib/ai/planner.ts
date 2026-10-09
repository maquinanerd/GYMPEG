// AI workout planner (G4, addendum 02 §16):
// GENERATE -> JSON SCHEMA -> DOMAIN VALIDATION (ids, gym, avoided, values)
// -> PROGRAM ANALYSIS -> PREVIEW -> the lifter confirms -> SAVE as a program
// version. Nothing here writes the model's answer to the database: saving is
// a separate call that validates the (possibly edited) plan again.

import type { MuscleGroup } from '@/lib/prisma-client';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { LlmError, type LlmMessage } from '@/lib/llm';
import {
  loadCatalogForPlanner,
  selectCandidates,
  type PlannerCandidate,
} from '@/lib/ai/exercise-retrieval';
import { buildTrainingContext, type TrainingContext } from '@/lib/ai/training-context';
import { cachedAiResult, runAiCompletion, storeAiResult } from '@/lib/ai/usage';
import {
  parseAiWorkoutPlan,
  validateWorkoutPlan,
  type AiWorkoutPlan,
  type PlanAnalysis,
  type PlanIssue,
} from '@/lib/ai/workout-plan';
import { defaultIntraSetConfig } from '@/lib/intra-set-autoregulation';
import { recordProgramRevision } from '@/lib/program-revisions';
import {
  WORKOUT_PLANNER_PROMPT_VERSION,
  WORKOUT_PLANNER_SYSTEM_PROMPT,
} from '@/lib/prompts/workout-planner';

export interface PlannerResult {
  plan: AiWorkoutPlan;
  warnings: PlanIssue[];
  analysis: PlanAnalysis;
  // Catalog names and muscles of the exercises the plan uses, for the preview
  // (which re-runs the validation while the lifter edits).
  exercises: Record<string, { name: string; primaryMuscles: MuscleGroup[] }>;
  availability: { sessionsPerWeek: number | null; sessionMinutes: number | null };
  promptVersion: string;
}

interface PlannerSetup {
  context: TrainingContext;
  offered: PlannerCandidate[];
  // Every exercise the lifter may use, for validating an edited plan.
  allowed: PlannerCandidate[];
  // Catalog names (the candidates carry the pt-BR name the model reads).
  names: Map<string, string>;
}

async function plannerSetup(userId: string): Promise<PlannerSetup> {
  const [context, catalog] = await Promise.all([
    buildTrainingContext(userId),
    loadCatalogForPlanner(userId),
  ]);
  const filters = {
    availableEquipment: context.equipment,
    avoidedIds: new Set(context.avoidedExerciseIds),
    preferredIds: new Set(context.preferredExerciseIds),
    priorityMuscles: context.priorities,
    level: (context.profile.experience as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null) ?? null,
  };
  return {
    context,
    offered: selectCandidates(catalog, filters),
    allowed: selectCandidates(catalog, {
      ...filters,
      perGroup: Number.POSITIVE_INFINITY,
      limit: Number.POSITIVE_INFINITY,
    }),
    names: new Map(catalog.map((row) => [row.id, row.name])),
  };
}

function validationContext(setup: PlannerSetup, candidates: PlannerCandidate[]) {
  return {
    candidates: new Map(candidates.map((c) => [c.id, c])),
    availableEquipment: setup.context.equipment,
    avoidedIds: new Set(setup.context.avoidedExerciseIds),
    sessionsPerWeek: setup.context.availability.sessionsPerWeek,
    sessionMinutes: setup.context.availability.sessionMinutes,
  };
}

function previewOf(
  setup: PlannerSetup,
  plan: AiWorkoutPlan,
  candidates: PlannerCandidate[],
  validation: { warnings: PlanIssue[]; analysis: PlanAnalysis },
): PlannerResult {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const exercises: PlannerResult['exercises'] = {};
  for (const workout of plan.workouts) {
    for (const exercise of workout.exercises) {
      const candidate = byId.get(exercise.exerciseId);
      if (candidate) {
        exercises[candidate.id] = {
          name: setup.names.get(candidate.id) ?? candidate.name,
          primaryMuscles: candidate.primaryMuscles,
        };
      }
    }
  }
  return {
    plan,
    warnings: validation.warnings,
    analysis: validation.analysis,
    exercises,
    availability: {
      sessionsPerWeek: setup.context.availability.sessionsPerWeek,
      sessionMinutes: setup.context.availability.sessionMinutes,
    },
    promptVersion: WORKOUT_PLANNER_PROMPT_VERSION,
  };
}

const issuesText = (issues: PlanIssue[]) =>
  issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n');

export async function generateWorkoutPlan(
  userId: string,
  input: { request: string; idempotencyKey?: string; locale?: string },
): Promise<PlannerResult> {
  const cached = await cachedAiResult<PlannerResult>(userId, input.idempotencyKey);
  if (cached) return cached;

  const setup = await plannerSetup(userId);
  if (setup.offered.length === 0) {
    throw new ApiError(422, 'No exercise fits your gym and preferences yet.');
  }
  const messages: LlmMessage[] = [
    {
      role: 'user',
      content: JSON.stringify({
        // The language of the title, rationale and names.
        locale: input.locale ?? 'pt-BR',
        request: input.request,
        context: setup.context,
        candidates: setup.offered,
      }),
    },
  ];

  // One controlled correction round: the model sees exactly what failed.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { text } = await runAiCompletion(
      userId,
      'GENERATE_PROGRAM',
      {
        system: WORKOUT_PLANNER_SYSTEM_PROMPT,
        messages,
        maxTokens: 6000,
        responseFormat: 'json',
      },
      WORKOUT_PLANNER_PROMPT_VERSION,
    );
    const parsed = parseAiWorkoutPlan(text);
    const issues: PlanIssue[] = parsed.ok
      ? validateWorkoutPlan(parsed.plan, validationContext(setup, setup.offered)).errors
      : [{ code: 'UNKNOWN_EXERCISE', path: 'plan', message: parsed.error }];
    if (parsed.ok && issues.length === 0) {
      const validation = validateWorkoutPlan(parsed.plan, validationContext(setup, setup.offered));
      const result = previewOf(setup, parsed.plan, setup.offered, validation);
      await storeAiResult(userId, input.idempotencyKey, 'GENERATE_PROGRAM', result);
      return result;
    }
    messages.push(
      { role: 'assistant', content: text },
      {
        role: 'user',
        content: `Your plan was rejected:\n${issuesText(issues)}\nAnswer again with the complete corrected JSON object, using only ids from "candidates".`,
      },
    );
  }
  throw new LlmError(502, 'The AI could not produce a valid plan. Try again.');
}

// Re-validates a plan (possibly edited in the preview) against everything the
// lifter may use. Used before saving.
export async function checkWorkoutPlan(
  userId: string,
  plan: AiWorkoutPlan,
): Promise<{ ok: boolean; errors: PlanIssue[]; result: PlannerResult }> {
  const setup = await plannerSetup(userId);
  const validation = validateWorkoutPlan(plan, validationContext(setup, setup.allowed));
  return {
    ok: validation.ok,
    errors: validation.errors,
    result: previewOf(setup, plan, setup.allowed, validation),
  };
}

// Saves a validated plan as a new, inactive program with its first version
// (source AI_GENERATED). Returns the program id.
export async function saveWorkoutPlan(userId: string, plan: AiWorkoutPlan): Promise<string> {
  const check = await checkWorkoutPlan(userId, plan);
  if (!check.ok) {
    throw new ApiError(400, `The plan is not valid: ${check.errors[0]?.message ?? 'invalid'}`);
  }
  const ids = [...new Set(plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))];
  const exercises = await db.exercise.findMany({ where: { id: { in: ids } } });
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const fixedDays = plan.workouts.every((workout) => workout.dayOfWeek != null);

  const programId = await db.$transaction(async (tx) => {
    const program = await tx.program.create({
      data: {
        userId,
        name: plan.title,
        description: plan.rationale.slice(0, 2000) || null,
        phase: 'AI',
        isActive: false,
        scheduleMode: fixedDays ? 'FIXED_DAYS' : 'ROTATION',
      },
    });
    let order = 1;
    for (const workout of plan.workouts) {
      const created = await tx.workout.create({
        data: {
          programId: program.id,
          name: workout.name,
          dayOfWeek: workout.dayOfWeek ?? null,
          order: order++,
        },
      });
      const sorted = [...workout.exercises].sort((a, b) => a.order - b.order);
      for (const [index, planned] of sorted.entries()) {
        const exercise = byId.get(planned.exerciseId)!;
        const autoregulation = defaultIntraSetConfig(exercise);
        // RPE maps onto reps in reserve when no RIR was given.
        const rir =
          planned.targetRir ??
          (planned.targetRpe != null
            ? Math.max(0, Math.min(5, Math.round(10 - planned.targetRpe)))
            : 2);
        await tx.programExercise.create({
          data: {
            workoutId: created.id,
            exerciseId: exercise.id,
            order: index + 1,
            targetSets: planned.sets,
            targetRepsMin: planned.repMin,
            targetRepsMax: planned.repMax,
            targetRIR: rir,
            restSec: planned.restSeconds,
            notes: planned.notes ?? null,
            fatigueRate: autoregulation.fatigueRate,
            loadAdjustmentPct: autoregulation.loadAdjustmentPct,
          },
        });
      }
    }
    return program.id;
  });
  await recordProgramRevision(programId, { source: 'AI_GENERATED' });
  return programId;
}
