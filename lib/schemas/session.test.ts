import { describe, it, expect } from 'vitest';
import { sessionStartSchema, sessionUpdateSchema } from './session';

describe('sessionStartSchema', () => {
  it('requires a non-empty workoutId', () => {
    expect(sessionStartSchema.parse({ workoutId: 'w1' }).workoutId).toBe('w1');
    expect(sessionStartSchema.safeParse({ workoutId: '' }).success).toBe(false);
    expect(sessionStartSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a device-generated UUIDv7 id and start time', () => {
    const parsed = sessionStartSchema.parse({
      workoutId: 'w1',
      id: '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e1f',
      startedAt: 1_760_000_000_000,
    });
    expect(parsed.id).toBe('0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e1f');
    expect(parsed.startedAt).toBe(1_760_000_000_000);
  });

  it('rejects an id that is not a UUIDv7', () => {
    expect(sessionStartSchema.safeParse({ workoutId: 'w1', id: 'cm1abcdef0000' }).success).toBe(
      false,
    );
    expect(
      sessionStartSchema.safeParse({
        workoutId: 'w1',
        id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
      }).success,
    ).toBe(false);
  });
});

describe('sessionUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(sessionUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('trims notes and accepts a finish flag', () => {
    const parsed = sessionUpdateSchema.parse({ notes: '  good session  ', finish: true });
    expect(parsed.notes).toBe('good session');
    expect(parsed.finish).toBe(true);
  });

  it('accepts the device time of a finish', () => {
    expect(sessionUpdateSchema.parse({ finish: true, finishedAt: 1_760_000_000_000 })).toEqual({
      finish: true,
      finishedAt: 1_760_000_000_000,
    });
    expect(sessionUpdateSchema.safeParse({ finish: true, finishedAt: -1 }).success).toBe(false);
  });

  it('rejects notes longer than 2000 characters', () => {
    expect(sessionUpdateSchema.safeParse({ notes: 'x'.repeat(2001) }).success).toBe(false);
  });
});
