import { describe, expect, it } from 'vitest';
import {
  dailyConditioning,
  exerciseProgress,
  isoWeekKey,
  isoWeekStart,
  trainingConsistency,
  weeklyFrequencyByMuscleGroup,
  weeklySetsByMuscleGroup,
} from './stats';

const SP = 'America/Sao_Paulo';
// Sunday 11 Oct 2026, 22:30 in Sao Paulo = Monday 12 Oct 01:30 UTC.
const SUNDAY_NIGHT = new Date('2026-10-12T01:30:00Z');
// Monday 12 Oct 2026, 07:00 in Sao Paulo.
const MONDAY_MORNING = new Date('2026-10-12T10:00:00Z');

describe('ISO weeks in the user time zone', () => {
  it('keeps a Sunday-night session in its own week', () => {
    expect(isoWeekKey(SUNDAY_NIGHT, SP)).toBe('2026-W41');
    expect(isoWeekKey(MONDAY_MORNING, SP)).toBe('2026-W42');
    // The historical UTC bucketing moves it to the next week.
    expect(isoWeekKey(SUNDAY_NIGHT)).toBe('2026-W42');
  });

  it('starts the week at local Monday midnight', () => {
    expect(isoWeekStart(SUNDAY_NIGHT, SP).toISOString()).toBe('2026-10-05T03:00:00.000Z');
    expect(isoWeekStart(MONDAY_MORNING, SP).toISOString()).toBe('2026-10-12T03:00:00.000Z');
  });
});

describe('aggregations with timeZone', () => {
  const sets = [
    { isWarmup: false, muscleGroup: 'CHEST', sessionStartedAt: SUNDAY_NIGHT },
    { isWarmup: false, muscleGroup: 'CHEST', sessionStartedAt: MONDAY_MORNING },
  ];

  it('counts weekly sets in the local week', () => {
    const local = weeklySetsByMuscleGroup(sets, { timeZone: SP });
    expect(local.map((w) => [w.weekKey, w.total])).toEqual([
      ['2026-W41', 1],
      ['2026-W42', 1],
    ]);
    const utc = weeklySetsByMuscleGroup(sets);
    expect(utc.map((w) => [w.weekKey, w.total])).toEqual([['2026-W42', 2]]);
  });

  it('counts frequency by local calendar day', () => {
    const local = weeklyFrequencyByMuscleGroup(sets, { timeZone: SP });
    expect(local.map((w) => w.byMuscleGroup.CHEST)).toEqual([1, 1]);
  });

  it('labels session points with the local date', () => {
    const points = exerciseProgress(
      [{ weight: 100, reps: 5, isWarmup: false, sessionId: 's1', sessionStartedAt: SUNDAY_NIGHT }],
      { timeZone: SP },
    );
    expect(points[0]!.date).toBe('2026-10-11');
  });

  it('builds the consistency window on local weeks', () => {
    const summary = trainingConsistency([SUNDAY_NIGHT, MONDAY_MORNING], {
      windowWeeks: 2,
      now: MONDAY_MORNING,
      timeZone: SP,
    });
    expect(summary.weeks.map((w) => [w.weekKey, w.trainedDays])).toEqual([
      ['2026-W41', 1],
      ['2026-W42', 1],
    ]);
    expect(summary.weeks[1]!.weekStartIso).toBe('2026-10-12T03:00:00.000Z');
    expect(summary.currentStreak).toBe(2);
  });

  it('keeps last week cardio out of the current local week', () => {
    const days = dailyConditioning(
      [{ isWarmup: false, durationSec: 1800, sessionStartedAt: SUNDAY_NIGHT }],
      { now: MONDAY_MORNING, timeZone: SP },
    );
    expect(days).toEqual([]);
  });
});
