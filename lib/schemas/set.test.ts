import { describe, it, expect } from 'vitest';
import {
  resolveSetType,
  RPE_VALUES,
  setInputSchema,
  setUpdateSchema,
  validateSetForCategory,
} from './set';

describe('setInputSchema', () => {
  const valid = { exerciseId: 'ex1', setNumber: 1, weight: 60, reps: 10 };

  it('accepts a minimal valid set and applies boolean defaults', () => {
    const parsed = setInputSchema.parse(valid);
    expect(parsed.isWarmup).toBe(false);
    expect(parsed.isDropSet).toBe(false);
  });

  it('coerces numeric strings', () => {
    const parsed = setInputSchema.parse({
      exerciseId: 'ex1',
      setNumber: '2',
      weight: '82.5',
      reps: '8',
    });
    expect(parsed.setNumber).toBe(2);
    expect(parsed.weight).toBe(82.5);
    expect(parsed.reps).toBe(8);
  });

  it('allows weight 0 (bodyweight) and a null rir', () => {
    expect(setInputSchema.parse({ ...valid, weight: 0, rir: null }).rir).toBeNull();
  });

  it('rejects an empty exerciseId', () => {
    expect(setInputSchema.safeParse({ ...valid, exerciseId: '' }).success).toBe(false);
  });

  it('rejects out-of-range weight, reps, setNumber, and rir', () => {
    expect(setInputSchema.safeParse({ ...valid, weight: 501 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, weight: -1 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, reps: 101 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, setNumber: 0 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, rir: 6 }).success).toBe(false);
  });

  it('rejects non-integer reps and setNumber', () => {
    expect(setInputSchema.safeParse({ ...valid, reps: 8.5 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, setNumber: 1.5 }).success).toBe(false);
  });

  it('leaves cardio fields undefined when absent (strength payloads unchanged)', () => {
    const parsed = setInputSchema.parse(valid);
    expect(parsed.durationSec).toBeUndefined();
    expect(parsed.distanceM).toBeUndefined();
  });

  it('accepts in-range duration and distance and coerces numeric strings', () => {
    const parsed = setInputSchema.parse({
      ...valid,
      durationSec: '750',
      distanceM: '2500',
    });
    expect(parsed.durationSec).toBe(750);
    expect(parsed.distanceM).toBe(2500);
  });

  it('rejects absurd duration and distance values', () => {
    expect(setInputSchema.safeParse({ ...valid, durationSec: 0 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, durationSec: 86401 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, durationSec: 12.5 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, distanceM: -1 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, distanceM: 1000001 }).success).toBe(false);
  });

  it('accepts in-range avg/max HR and coerces numeric strings', () => {
    const parsed = setInputSchema.parse({ ...valid, avgHr: '150', maxHr: '178' });
    expect(parsed.avgHr).toBe(150);
    expect(parsed.maxHr).toBe(178);
  });

  it('rejects out-of-range or non-integer max HR (issue #203)', () => {
    expect(setInputSchema.safeParse({ ...valid, maxHr: 39 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, maxHr: 251 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, maxHr: 150.5 }).success).toBe(false);
  });

  it('accepts every offered RPE and a null RPE', () => {
    for (const rpe of RPE_VALUES) {
      expect(setInputSchema.parse({ ...valid, rpe }).rpe).toBe(rpe);
    }
    expect(setInputSchema.parse({ ...valid, rpe: null }).rpe).toBeNull();
  });

  it('rejects an RPE outside 6..10 or off the half steps', () => {
    expect(setInputSchema.safeParse({ ...valid, rpe: 5.5 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, rpe: 10.5 }).success).toBe(false);
    expect(setInputSchema.safeParse({ ...valid, rpe: 8.25 }).success).toBe(false);
  });

  it('accepts a known set type and rejects an unknown one', () => {
    expect(setInputSchema.parse({ ...valid, type: 'AMRAP' }).type).toBe('AMRAP');
    expect(setInputSchema.safeParse({ ...valid, type: 'SUPER' }).success).toBe(false);
  });
});

describe('resolveSetType', () => {
  it('derives the type from the legacy flags of older clients', () => {
    expect(resolveSetType({})).toEqual({ type: 'WORKING', isWarmup: false, isDropSet: false });
    expect(resolveSetType({ isWarmup: true })).toEqual({
      type: 'WARMUP',
      isWarmup: true,
      isDropSet: false,
    });
    expect(resolveSetType({ isDropSet: true })).toEqual({
      type: 'DROP',
      isWarmup: false,
      isDropSet: true,
    });
  });

  it('lets warm-up win when both legacy flags are set', () => {
    expect(resolveSetType({ isWarmup: true, isDropSet: true }).type).toBe('WARMUP');
  });

  it('lets an explicit type win and keeps the flags in agreement with it', () => {
    expect(resolveSetType({ type: 'AMRAP', isWarmup: true })).toEqual({
      type: 'AMRAP',
      isWarmup: false,
      isDropSet: false,
    });
    expect(resolveSetType({ type: 'DROP' })).toEqual({
      type: 'DROP',
      isWarmup: false,
      isDropSet: true,
    });
  });
});

describe('setUpdateSchema', () => {
  it('requires an explicit rir value so PATCH cannot clear it by omission', () => {
    expect(setUpdateSchema.safeParse({ weight: 60, reps: 10 }).success).toBe(false);
    expect(setUpdateSchema.parse({ weight: 60, reps: 10, rir: null })).toEqual({
      weight: 60,
      reps: 10,
      rir: null,
    });
  });

  it('accepts an RPE edit and leaves it out when absent', () => {
    expect(setUpdateSchema.parse({ weight: 60, reps: 10, rir: 2, rpe: 8.5 }).rpe).toBe(8.5);
    expect(setUpdateSchema.parse({ weight: 60, reps: 10, rir: 2 })).not.toHaveProperty('rpe');
    expect(setUpdateSchema.safeParse({ weight: 60, reps: 10, rir: 2, rpe: 11 }).success).toBe(
      false,
    );
  });
});

describe('validateSetForCategory', () => {
  it('accepts a strength set without cardio fields on any strength category', () => {
    expect(validateSetForCategory('COMPOUND', {})).toBeNull();
    expect(validateSetForCategory('ISOLATION', { durationSec: null, distanceM: null })).toBeNull();
  });

  it('rejects duration or distance on non-cardio exercises', () => {
    expect(validateSetForCategory('COMPOUND', { durationSec: 600 })).toMatch(/cardio/i);
    expect(validateSetForCategory('ISOLATION', { distanceM: 1000 })).toMatch(/cardio/i);
  });

  it('rejects a max HR on non-cardio exercises (issue #203)', () => {
    expect(validateSetForCategory('COMPOUND', { maxHr: 170 })).toMatch(/cardio/i);
  });

  it('requires a duration on cardio exercises', () => {
    expect(validateSetForCategory('CARDIO', {})).toMatch(/duration/i);
    expect(validateSetForCategory('CARDIO', { distanceM: 1000 })).toMatch(/duration/i);
  });

  it('accepts a cardio set with a duration (distance optional)', () => {
    expect(validateSetForCategory('CARDIO', { durationSec: 750 })).toBeNull();
    expect(validateSetForCategory('CARDIO', { durationSec: 750, distanceM: 2500 })).toBeNull();
  });
});
