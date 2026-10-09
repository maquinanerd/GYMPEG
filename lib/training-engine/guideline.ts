// Parameters of the deterministic training engine (ADR-007), versioned so a
// persisted recommendation always says which rules produced it. A change of
// any value below is a new version.

import type { ExerciseCategory, WeightUnit } from '@/lib/prisma-client';

export const TRAINING_GUIDELINE = {
  version: 'engine-v2.2026-10-09',
  source:
    'Double progression on the prescribed rep range; one loadable step down below the range; 10% deload; readiness may only hold or lower the load.',
  // Load step per exercise category, in the lifter's own unit, so a pound
  // user progresses by plates they actually have.
  increments: {
    KG: { COMPOUND: 2.5, ISOLATION: 1, CARDIO: 0 },
    LB: { COMPOUND: 5, ISOLATION: 2.5, CARDIO: 0 },
  } satisfies Record<WeightUnit, Record<ExerciseCategory, number>>,
  // Share of the working load removed by a deload (planned or readiness).
  deloadFraction: 0.1,
  // A check-in only auto-regulates today's load if it is this recent.
  readinessRecencyHours: 36,
  // Overall readiness, 1 (drained) to 5 (primed): hold at or below, deload at
  // or below.
  readinessHoldAtOrBelow: 2,
  readinessDeloadAtOrBelow: 1,
  // Soreness of the exercise's muscle, 1 (none) to 5 (severe).
  sorenessHoldAtOrAbove: 4,
  sorenessDeloadAtOrAbove: 5,
} as const;

export type TrainingGuideline = typeof TRAINING_GUIDELINE;
