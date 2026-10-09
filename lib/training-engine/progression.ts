// Next-load recommendation of the training engine v2 (ADR-007). A pure
// function of the prescription, the last performance of that prescription,
// the equipment, the unit and the optional readiness and deload signals; the
// same inputs always give the same decision, which is persisted with them
// (TrainingRecommendation) so it can be audited and explained.
//
// Rules (TRAINING_GUIDELINE):
// - no working set last time: INSUFFICIENT_DATA;
// - planned deload (cycle week or "deload this week"): DELOAD, 10% lighter;
// - readiness may only make it more conservative: very poor recovery DELOAD,
//   poor recovery HOLD;
// - every working set at the top of the rep range: INCREASE by one step;
// - most working sets below the bottom of the range: DECREASE by one step;
// - otherwise HOLD and beat the reps.
// Weights are kg (storage unit); the step is taken in the lifter's unit and
// every value is snapped to a load the equipment can make.

import type { ExerciseCategory, MuscleGroup, WeightUnit } from '@/lib/prisma-client';
import { constrainGymWeight, type GymLoadConstraints } from '@/lib/gym-loads';
import { fromDisplayWeight } from '@/lib/units';
import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';

export type RecommendationAction =
  | 'INCREASE'
  | 'HOLD'
  | 'DECREASE'
  | 'DELOAD'
  | 'INSUFFICIENT_DATA';

export type RecommendationReason =
  | 'no-history'
  | 'top-of-range'
  | 'within-range'
  | 'below-range'
  | 'planned-deload'
  | 'readiness-hold'
  | 'readiness-deload';

export interface ReadinessInput {
  // Overall readiness to train, 1 (drained) to 5 (primed).
  readiness: number;
  // Per-muscle-group soreness, 1 (none) to 5 (severe).
  soreness?: Partial<Record<MuscleGroup, number>> | null;
  // How old the check-in is, in hours.
  ageHours: number;
}

export interface RecommendationInput {
  prescription: {
    targetRepsMin: number;
    targetRepsMax: number;
    targetRIR?: number | null;
  };
  exercise: { category: ExerciseCategory; muscleGroup: MuscleGroup };
  // Working sets (no warm-ups) of the last session of this prescription.
  lastSets: { weight: number; reps: number; rir: number | null }[];
  unit?: WeightUnit;
  readiness?: ReadinessInput | null;
  plannedDeload?: boolean;
  loadConstraints?: GymLoadConstraints | null;
}

export interface Recommendation {
  action: RecommendationAction;
  // Recommended working load in kg; null without history.
  valueKg: number | null;
  reason: RecommendationReason;
  // Change from the working load in kg (negative when lighter).
  deltaKg: number | null;
  inputs: {
    workingWeightKg: number | null;
    workingSets: { weight: number; reps: number; rir: number | null }[];
    targetRepsMin: number;
    targetRepsMax: number;
    targetRIR: number | null;
    unit: WeightUnit;
    stepKg: number;
    readiness: ReadinessInput | null;
    plannedDeload: boolean;
  };
  guidelineVersion: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// One progression step in kg for the category, taken in the lifter's unit.
export function loadStepKg(category: ExerciseCategory, unit: WeightUnit = 'KG'): number {
  return round2(fromDisplayWeight(TRAINING_GUIDELINE.increments[unit][category], unit));
}

type Recovery = 'ok' | 'hold' | 'deload';

// Whether a recent check-in makes the recommendation more conservative. A
// stale or missing check-in changes nothing.
export function assessRecovery(
  readiness: ReadinessInput | null | undefined,
  muscleGroup: MuscleGroup,
): Recovery {
  if (!readiness || !(readiness.ageHours <= TRAINING_GUIDELINE.readinessRecencyHours)) {
    return 'ok';
  }
  const soreness = readiness.soreness?.[muscleGroup];
  if (
    readiness.readiness <= TRAINING_GUIDELINE.readinessDeloadAtOrBelow ||
    (typeof soreness === 'number' && soreness >= TRAINING_GUIDELINE.sorenessDeloadAtOrAbove)
  ) {
    return 'deload';
  }
  if (
    readiness.readiness <= TRAINING_GUIDELINE.readinessHoldAtOrBelow ||
    (typeof soreness === 'number' && soreness >= TRAINING_GUIDELINE.sorenessHoldAtOrAbove)
  ) {
    return 'hold';
  }
  return 'ok';
}

export function recommendNextLoad(input: RecommendationInput): Recommendation {
  const unit = input.unit ?? 'KG';
  const stepKg = loadStepKg(input.exercise.category, unit);
  // Only the sets at the working load decide; lighter drop or back-off sets
  // are ignored.
  const workingWeightKg =
    input.lastSets.length > 0 ? Math.max(...input.lastSets.map((set) => set.weight)) : null;
  const workingSets =
    workingWeightKg == null ? [] : input.lastSets.filter((set) => set.weight === workingWeightKg);
  const inputs: Recommendation['inputs'] = {
    workingWeightKg,
    workingSets,
    targetRepsMin: input.prescription.targetRepsMin,
    targetRepsMax: input.prescription.targetRepsMax,
    targetRIR: input.prescription.targetRIR ?? null,
    unit,
    stepKg,
    readiness: input.readiness ?? null,
    plannedDeload: input.plannedDeload === true,
  };
  const decide = (
    action: RecommendationAction,
    reason: RecommendationReason,
    targetKg: number | null,
  ): Recommendation => {
    if (targetKg == null || workingWeightKg == null) {
      return {
        action,
        reason,
        valueKg: null,
        deltaKg: null,
        inputs,
        guidelineVersion: TRAINING_GUIDELINE.version,
      };
    }
    const valueKg = constrainGymWeight(
      Math.max(0, round2(targetKg)),
      workingWeightKg,
      input.loadConstraints,
    );
    return {
      action,
      reason,
      valueKg,
      deltaKg: round2(valueKg - workingWeightKg),
      inputs,
      guidelineVersion: TRAINING_GUIDELINE.version,
    };
  };

  if (workingWeightKg == null) return decide('INSUFFICIENT_DATA', 'no-history', null);

  // What the performance alone calls for.
  const { targetRepsMin, targetRepsMax } = input.prescription;
  const belowRange = workingSets.filter((set) => set.reps < targetRepsMin).length;
  const baseline: [RecommendationAction, RecommendationReason, number] = workingSets.every(
    (set) => set.reps >= targetRepsMax,
  )
    ? ['INCREASE', 'top-of-range', workingWeightKg + stepKg]
    : belowRange * 2 > workingSets.length && workingWeightKg > 0
      ? ['DECREASE', 'below-range', workingWeightKg - stepKg]
      : ['HOLD', 'within-range', workingWeightKg];

  // Deloads and readiness only ever lower the load, never above the baseline.
  // A planned deload wins over an increase and over a readiness hold; it is
  // the same single reduction as a readiness deload, never both stacked.
  const deloadKg = Math.min(workingWeightKg * (1 - TRAINING_GUIDELINE.deloadFraction), baseline[2]);
  if (input.plannedDeload) return decide('DELOAD', 'planned-deload', deloadKg);

  const recovery = assessRecovery(input.readiness, input.exercise.muscleGroup);
  if (recovery === 'deload') return decide('DELOAD', 'readiness-deload', deloadKg);
  if (recovery === 'hold' && baseline[0] !== 'DECREASE') {
    return decide('HOLD', 'readiness-hold', workingWeightKg);
  }
  return decide(...baseline);
}
