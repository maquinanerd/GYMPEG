import type { Exercise, MuscleGroup, ProgramExercise, Set, WeightUnit } from '@/lib/prisma-client';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';
import { loadStepKg, recommendNextLoad } from '@/lib/training-engine/progression';

// ============================================================
// Load suggestion of the session UI (double progression)
// ============================================================
// Thin adapter over the training engine v2 (lib/training-engine): the
// session screens keep this compact shape while the engine owns the rules.
// Every working set at the top of the rep range adds one step (2.5 kg / 5 lb
// compound, 1 kg / 2.5 lb isolation); most sets below the range take one step
// off; otherwise the load stays and the reps are beaten.
//
// Auto-regulation (issue #53): a recent readiness/soreness check-in may hold
// the load or apply a single step-down, never raise it. A planned deload week
// takes the working load 10% down.

export type SuggestionReason =
  | 'no-history'
  | 'same-as-last'
  | 'progression'
  | 'below-range'
  | 'readiness-hold'
  | 'readiness-deload'
  | 'planned-deload';

export interface SuggestionResult {
  weight: number | null;
  reason: SuggestionReason;
  // Reference load taken from the last session (max non-warmup weight).
  workingWeight?: number;
  // Change applied when progressing or stepping down (kg).
  delta?: number;
  // Top of the rep range used as the progression threshold.
  targetRepsMax?: number;
}

// Readiness thresholds, from the versioned engine guideline.
export const READINESS_RECENCY_HOURS = TRAINING_GUIDELINE.readinessRecencyHours;
export const READINESS_HOLD_AT_OR_BELOW = TRAINING_GUIDELINE.readinessHoldAtOrBelow;
export const READINESS_DELOAD_AT_OR_BELOW = TRAINING_GUIDELINE.readinessDeloadAtOrBelow;
export const SORENESS_HOLD_AT_OR_ABOVE = TRAINING_GUIDELINE.sorenessHoldAtOrAbove;
export const SORENESS_DELOAD_AT_OR_ABOVE = TRAINING_GUIDELINE.sorenessDeloadAtOrAbove;
export const READINESS_DELOAD_FRACTION = TRAINING_GUIDELINE.deloadFraction;

// A recent readiness check-in, shaped for pure progression logic. The caller
// resolves recency by passing `ageHours`, keeping this module clock-free.
export interface ReadinessSignal {
  // Overall readiness to train, 1 (drained) to 5 (primed).
  readiness: number;
  // Optional per-muscle-group soreness, group -> 1 (none) to 5 (severe).
  soreness?: Partial<Record<MuscleGroup, number>> | null;
  // How old the check-in is, in hours. Used against READINESS_RECENCY_HOURS.
  ageHours: number;
}

// Applies the user's auto-regulation preference (issue #61): when it is off,
// the readiness signal is dropped and the suggestion follows the programmed
// progression only.
export function readinessForSuggestion(
  readiness: ReadinessSignal | null,
  autoRegulationEnabled: boolean,
): ReadinessSignal | null {
  return autoRegulationEnabled ? readiness : null;
}

export function suggestNextWeight(
  programExercise: ProgramExercise & { exercise: Exercise },
  lastSets: Pick<Set, 'weight' | 'reps' | 'rir'>[],
  readiness?: ReadinessSignal | null,
  // True while a planned deload runs (lib/deload.ts isDeloadActive or the
  // program cycle's deload week), resolved by the caller against the clock.
  plannedDeload?: boolean,
  loadConstraints?: GymLoadConstraints | null,
  unit: WeightUnit = 'KG',
): SuggestionResult {
  const decision = recommendNextLoad({
    prescription: programExercise,
    exercise: programExercise.exercise,
    lastSets,
    unit,
    readiness,
    plannedDeload,
    loadConstraints,
  });
  if (decision.action === 'INSUFFICIENT_DATA') return { weight: null, reason: 'no-history' };

  const base = {
    weight: decision.valueKg,
    workingWeight: decision.inputs.workingWeightKg ?? undefined,
    targetRepsMax: programExercise.targetRepsMax,
  };
  switch (decision.reason) {
    case 'top-of-range':
      return { ...base, reason: 'progression', delta: decision.deltaKg ?? 0 };
    case 'below-range':
      return { ...base, reason: 'below-range', delta: decision.deltaKg ?? 0 };
    case 'planned-deload':
    case 'readiness-deload':
    case 'readiness-hold':
      return { ...base, reason: decision.reason };
    default:
      return { ...base, reason: 'same-as-last' };
  }
}

// Standard increment for the +/- buttons and the progression step, in kg,
// for the category in the lifter's unit (2.5 kg or 5 lb compound, 1 kg or
// 2.5 lb isolation).
export function weightIncrement(category: Exercise['category'], unit: WeightUnit = 'KG'): number {
  return loadStepKg(category, unit);
}
