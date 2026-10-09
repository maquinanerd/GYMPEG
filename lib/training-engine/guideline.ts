// Parameters of the deterministic training engine (ADR-007, epic 2.6): the
// single place for them, versioned so a persisted recommendation or report
// always says which rules produced it. A change of any value below is a new
// version (and a new `updatedAt`). Served read-only by GET
// /api/training-guideline so the coach can cite the rules it is explaining.

import type { ExerciseCategory, WeightUnit } from '@/lib/prisma-client';

export const TRAINING_GUIDELINE = {
  version: 'engine-v2.3.2026-10-09',
  updatedAt: '2026-10-09',
  source:
    'GYM Peg training engine: double progression on the prescribed rep range, one loadable step down below it, 10% deloads; readiness only holds or lowers the load; volume landmarks are general hypertrophy heuristics (MEV/MRV), not prescriptions.',
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
  // Estimated 1RM for records: Epley, trusted only up to this many reps (a
  // 20-rep set says little about a single). Charts keep the uncapped value.
  e1rm: { formula: 'EPLEY', maxReps: 12 },
  // Volume per muscle: a set counts fully for the exercise's primary muscles
  // and by this share for the secondary ones (stabilizers do not count). An
  // estimate for comparing weeks, not a physiological measurement.
  secondarySetShare: 0.5,
  // A working set is "effective" (hard enough to drive adaptation) at this
  // many reps in reserve or fewer, or this RPE or more; unrated sets count.
  effectiveSetMaxRIR: 4,
  effectiveSetMinRPE: 6,
  // Default weekly effective-set band per muscle group (MEV-MRV), overridable
  // per muscle by the lifter (VolumeTarget). A general hypertrophy heuristic.
  weeklySetsMEV: 10,
  weeklySetsMRV: 20,
  // Stall: the best e1RM does not improve by more than this share over the
  // last sessions, which must also span this many days.
  stallLookbackSessions: 3,
  stallTolerance: 0.005,
  stallMinSpanDays: 10,
  // Deload recommendation: stalled lifts, chronically low readiness (average
  // of the latest check-ins, fresh ones only) or a long block without one.
  deloadStalledLiftsMin: 2,
  deloadReadinessLookback: 5,
  deloadReadinessMinCheckins: 3,
  deloadReadinessMaxAgeDays: 14,
  deloadLongBlockWeeks: 8,
  deloadLongBlockTrainedShare: 0.75,
  deloadDurationDays: 7,
} as const;

export type TrainingGuideline = typeof TRAINING_GUIDELINE;
