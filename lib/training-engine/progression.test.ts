import { describe, expect, it } from 'vitest';
import { TRAINING_GUIDELINE } from './guideline';
import { loadStepKg, recommendNextLoad, type RecommendationInput } from './progression';

const squat = (
  lastSets: RecommendationInput['lastSets'],
  extra: Partial<RecommendationInput> = {},
) =>
  recommendNextLoad({
    prescription: { targetRepsMin: 6, targetRepsMax: 8, targetRIR: 2 },
    exercise: { category: 'COMPOUND', muscleGroup: 'QUADS' },
    lastSets,
    ...extra,
  });

const sets = (weight: number, ...reps: number[]) => reps.map((r) => ({ weight, reps: r, rir: 2 }));

describe('recommendNextLoad', () => {
  it('has no recommendation without history', () => {
    expect(squat([])).toMatchObject({
      action: 'INSUFFICIENT_DATA',
      reason: 'no-history',
      valueKg: null,
      deltaKg: null,
    });
  });

  it('increases one step when every working set reached the top of the range', () => {
    expect(squat(sets(100, 8, 8, 9))).toMatchObject({
      action: 'INCREASE',
      reason: 'top-of-range',
      valueKg: 102.5,
      deltaKg: 2.5,
    });
  });

  it('holds within the range and decreases when most sets fell below it', () => {
    expect(squat(sets(100, 8, 7, 6))).toMatchObject({ action: 'HOLD', valueKg: 100 });
    // One set below the range is not a trend.
    expect(squat(sets(100, 7, 6, 5))).toMatchObject({ action: 'HOLD', reason: 'within-range' });
    expect(squat(sets(100, 6, 5, 4))).toMatchObject({
      action: 'DECREASE',
      reason: 'below-range',
      valueKg: 97.5,
      deltaKg: -2.5,
    });
  });

  it('steps in the lifter unit: 5 lb on a compound, 2.5 lb on an isolation', () => {
    expect(loadStepKg('COMPOUND', 'LB')).toBe(2.27);
    expect(loadStepKg('ISOLATION', 'LB')).toBe(1.13);
    expect(loadStepKg('ISOLATION', 'KG')).toBe(1);
    expect(squat(sets(100, 8, 8), { unit: 'LB' })).toMatchObject({ valueKg: 102.27 });
  });

  it('snaps the recommendation to a load the equipment can make', () => {
    const machine = { equipmentType: 'MACHINE' as const, weightOptions: [90, 95, 100, 105, 110] };
    expect(squat(sets(100, 8, 8), { loadConstraints: machine })).toMatchObject({
      action: 'INCREASE',
      valueKg: 105,
      deltaKg: 5,
    });
  });

  it('deloads 10% in a planned deload week, whatever the performance', () => {
    expect(squat(sets(100, 8, 8), { plannedDeload: true })).toMatchObject({
      action: 'DELOAD',
      reason: 'planned-deload',
      valueKg: 90,
    });
  });

  it('lets readiness only hold or lower the load, never above the performance call', () => {
    const fresh = { readiness: 2, ageHours: 3 };
    expect(squat(sets(100, 8, 8), { readiness: fresh })).toMatchObject({
      action: 'HOLD',
      reason: 'readiness-hold',
      valueKg: 100,
    });
    // A hold does not undo a step down.
    expect(squat(sets(100, 5, 5), { readiness: fresh })).toMatchObject({ action: 'DECREASE' });
    // A deload never lands above the step down (20 kg: 18 vs 17.5).
    expect(squat(sets(20, 5, 5), { readiness: { readiness: 1, ageHours: 3 } })).toMatchObject({
      action: 'DELOAD',
      valueKg: 17.5,
    });
    // Soreness counts only on the exercise's own muscle, and a stale check-in is ignored.
    expect(
      squat(sets(100, 8, 8), { readiness: { readiness: 5, soreness: { CHEST: 5 }, ageHours: 3 } }),
    ).toMatchObject({ action: 'INCREASE' });
    expect(squat(sets(100, 8, 8), { readiness: { readiness: 1, ageHours: 48 } })).toMatchObject({
      action: 'INCREASE',
    });
  });

  it('records the inputs and the guideline version with the decision', () => {
    const decision = squat([...sets(100, 8, 8), { weight: 80, reps: 12, rir: 0 }]);
    expect(decision.guidelineVersion).toBe(TRAINING_GUIDELINE.version);
    expect(decision.inputs).toEqual({
      workingWeightKg: 100,
      // The lighter back-off set does not take part in the decision.
      workingSets: sets(100, 8, 8),
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetRIR: 2,
      unit: 'KG',
      stepKg: 2.5,
      readiness: null,
      plannedDeload: false,
    });
  });

  it('is deterministic: same inputs, same decision', () => {
    const input = sets(60, 8, 7, 8);
    expect(squat(input)).toEqual(squat(input));
  });
});
