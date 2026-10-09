import { describe, expect, it } from 'vitest';
import { calculateE1RM, detectSessionRecords, type RecordSet } from './records';

const set = (
  sessionId: string,
  weight: number,
  reps: number,
  extra: Partial<RecordSet> = {},
): RecordSet => ({ sessionId, exerciseId: 'bench', weekKey: '2026-W40', weight, reps, ...extra });

const types = (records: { type: string }[]) => records.map((record) => record.type);

describe('calculateE1RM', () => {
  it('uses Epley up to 12 reps and says nothing past that', () => {
    expect(calculateE1RM(100, 5)).toBeCloseTo(116.67, 2);
    expect(calculateE1RM(100, 12)).toBeCloseTo(140, 5);
    expect(calculateE1RM(60, 13)).toBeNull();
    expect(calculateE1RM(0, 5)).toBeNull();
  });
});

describe('detectSessionRecords', () => {
  const before = [set('s1', 100, 5), set('s1', 100, 5), set('s1', 80, 8)];

  it('treats a first time as a baseline, never a record', () => {
    expect(detectSessionRecords({ sessionSets: [set('s1', 100, 5)], priorSets: [] })).toEqual([]);
  });

  it('records a heavier load with its previous best and the set behind it', () => {
    const records = detectSessionRecords({
      sessionSets: [set('s2', 105, 3)],
      priorSets: before,
    });
    expect(records).toContainEqual({
      type: 'WEIGHT',
      exerciseId: 'bench',
      value: 105,
      previous: 100,
      weightKg: 105,
      reps: 3,
    });
  });

  it('records more reps at a load against that load or heavier', () => {
    const records = detectSessionRecords({ sessionSets: [set('s2', 100, 7)], priorSets: before });
    expect(records).toContainEqual(
      expect.objectContaining({ type: 'REPS', value: 7, previous: 5, weightKg: 100 }),
    );
    // 9 reps at 80 kg beats the 8 done at 80 kg (the 100 kg sets had fewer).
    const lighter = detectSessionRecords({ sessionSets: [set('s2', 80, 9)], priorSets: before });
    expect(lighter).toContainEqual(
      expect.objectContaining({ type: 'REPS', value: 9, previous: 8 }),
    );
    // A load never lifted before has no reps to beat.
    const heavier = detectSessionRecords({ sessionSets: [set('s2', 110, 2)], priorSets: before });
    expect(types(heavier)).not.toContain('REPS');
  });

  it('records a better e1RM, ignoring sets past the rep cap', () => {
    const better = detectSessionRecords({ sessionSets: [set('s2', 100, 7)], priorSets: before });
    expect(better).toContainEqual(
      expect.objectContaining({ type: 'E1RM', value: 123.3, previous: 116.7 }),
    );
    // 60 x 20 would be 100 by Epley but is past the cap: no e1RM record.
    const highReps = detectSessionRecords({
      sessionSets: [set('s2', 60, 20)],
      priorSets: [set('s1', 60, 10)],
    });
    expect(types(highReps)).not.toContain('E1RM');
  });

  it('records the biggest single set, exercise volume and workout tonnage', () => {
    const records = detectSessionRecords({
      sessionSets: [set('s2', 100, 7), set('s2', 100, 7), set('s2', 100, 7)],
      priorSets: before,
    });
    // Before: best set 80 x 8 = 640, session total 500 + 500 + 640 = 1640.
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SET_VOLUME', value: 700, previous: 640 }),
        expect.objectContaining({ type: 'EXERCISE_VOLUME', value: 2100, previous: 1640 }),
        expect.objectContaining({ type: 'WORKOUT_TONNAGE', exerciseId: null, value: 2100 }),
      ]),
    );
  });

  it('gives the weekly record once, to the session that crosses the best week', () => {
    const lastWeek = [set('a', 100, 10, { weekKey: '2026-W39' })]; // 1000
    const monday = [set('b', 100, 6, { weekKey: '2026-W40' })]; // 600
    const crossing = detectSessionRecords({
      sessionSets: [set('c', 100, 5, { weekKey: '2026-W40' })], // week 1100
      priorSets: [...lastWeek, ...monday],
    });
    expect(crossing).toContainEqual({
      type: 'WEEKLY_TONNAGE',
      exerciseId: null,
      value: 1100,
      previous: 1000,
    });
    const afterwards = detectSessionRecords({
      sessionSets: [set('d', 100, 5, { weekKey: '2026-W40' })],
      priorSets: [...lastWeek, ...monday, set('c', 100, 5, { weekKey: '2026-W40' })],
    });
    expect(types(afterwards)).not.toContain('WEEKLY_TONNAGE');
  });

  it('never calls a tie a record and keeps exercises apart', () => {
    const tie = detectSessionRecords({ sessionSets: [set('s2', 100, 5)], priorSets: before });
    expect(
      types(tie).filter((type) => type !== 'WORKOUT_TONNAGE' && type !== 'WEEKLY_TONNAGE'),
    ).toEqual([]);
    const otherLift = detectSessionRecords({
      sessionSets: [set('s2', 200, 5, { exerciseId: 'squat' })],
      priorSets: before,
    });
    // Squat has no history: no squat record, only the session-wide ones.
    expect(otherLift.every((record) => record.exerciseId !== 'squat')).toBe(true);
  });
});
