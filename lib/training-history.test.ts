import { describe, expect, it } from 'vitest';
import { describeSet } from './training-history';

const base = {
  weight: 80,
  reps: 8,
  rir: 2,
  isWarmup: false,
  isDropSet: false,
  durationSec: null,
  distanceM: null,
};

describe('describeSet', () => {
  it('reads a strength set as load x reps with its RIR', () => {
    expect(describeSet(base)).toBe('80 kg x 8 @RIR 2');
    expect(describeSet({ ...base, weight: 72.5, rir: null })).toBe('72.5 kg x 8');
  });

  it('flags warm-up and drop sets', () => {
    expect(describeSet({ ...base, weight: 40, isWarmup: true, rir: null })).toBe(
      '40 kg x 8 (warm-up)',
    );
    expect(describeSet({ ...base, weight: 60, isDropSet: true })).toBe(
      '60 kg x 8 @RIR 2 (drop set)',
    );
  });

  it('reads a cardio set as minutes and km', () => {
    expect(describeSet({ ...base, durationSec: 1500, distanceM: 5000 })).toBe('25 min, 5.00 km');
    expect(describeSet({ ...base, durationSec: 600, distanceM: null })).toBe('10 min');
  });
});
