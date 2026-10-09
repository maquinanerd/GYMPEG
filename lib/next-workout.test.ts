import { describe, expect, it } from 'vitest';
import { nextWorkout, type ScheduleWorkout } from './next-workout';
import { zonedIsoWeekday } from './timezone';

const workout = (
  id: string,
  order: number,
  dayOfWeek: number | null = null,
  exerciseCount = 4,
): ScheduleWorkout => ({ id, order, dayOfWeek, exerciseCount });

const abc = [workout('a', 1, 1), workout('b', 2, 3), workout('c', 3, 5)];

describe('nextWorkout - rotation', () => {
  const rotation = (lastWorkoutId: string | null, workouts = abc) =>
    nextWorkout({ mode: 'ROTATION', workouts, lastWorkoutId, doneTodayIds: [], today: 2 });

  it('starts at the first workout without history', () => {
    expect(rotation(null)).toEqual({ kind: 'rotation', workoutId: 'a', afterWorkoutId: null });
  });

  it('continues after the last workout done and cycles back', () => {
    expect(rotation('a')).toMatchObject({ workoutId: 'b', afterWorkoutId: 'a' });
    expect(rotation('c')).toMatchObject({ workoutId: 'a', afterWorkoutId: 'c' });
  });

  it('follows the program order, not the creation order', () => {
    const reordered = [workout('a', 3), workout('b', 1), workout('c', 2)];
    expect(rotation('b', reordered)).toMatchObject({ workoutId: 'c' });
  });

  it('skips empty workouts and restarts when the last one was removed', () => {
    const withEmpty = [workout('a', 1), workout('empty', 2, null, 0), workout('c', 3)];
    expect(rotation('a', withEmpty)).toMatchObject({ workoutId: 'c' });
    expect(rotation('deleted', withEmpty)).toMatchObject({ workoutId: 'a', afterWorkoutId: null });
  });

  it('suggests nothing when no workout has exercises', () => {
    expect(rotation(null, [workout('empty', 1, null, 0)])).toBeNull();
  });
});

describe('nextWorkout - fixed days', () => {
  const fixed = (today: number, doneTodayIds: string[] = [], workouts = abc) =>
    nextWorkout({ mode: 'FIXED_DAYS', workouts, lastWorkoutId: null, doneTodayIds, today });

  it("suggests today's workout", () => {
    expect(fixed(3)).toEqual({ kind: 'today', workoutId: 'b' });
  });

  it('points to the next scheduled day on a rest day', () => {
    expect(fixed(2)).toEqual({ kind: 'upcoming', workoutId: 'b', dayOfWeek: 3, inDays: 1 });
    // Saturday: next is Monday, two days later.
    expect(fixed(6)).toEqual({ kind: 'upcoming', workoutId: 'a', dayOfWeek: 1, inDays: 2 });
  });

  it("moves on once today's workout is done", () => {
    expect(fixed(1, ['a'])).toEqual({ kind: 'upcoming', workoutId: 'b', dayOfWeek: 3, inDays: 2 });
  });

  it('comes back to the same weekday a week later when it is the only one', () => {
    expect(fixed(1, ['a'], [workout('a', 1, 1)])).toEqual({
      kind: 'upcoming',
      workoutId: 'a',
      dayOfWeek: 1,
      inDays: 7,
    });
  });

  it('behaves as a rotation when no workout has a day', () => {
    expect(fixed(1, [], [workout('a', 1), workout('b', 2)])).toMatchObject({
      kind: 'rotation',
      workoutId: 'a',
    });
  });
});

describe('zonedIsoWeekday', () => {
  it("uses the zone's calendar day", () => {
    // Monday 01:00 UTC is still Sunday evening in São Paulo.
    const instant = new Date('2026-10-05T01:00:00Z');
    expect(zonedIsoWeekday(instant, 'UTC')).toBe(1);
    expect(zonedIsoWeekday(instant, 'America/Sao_Paulo')).toBe(7);
  });
});
