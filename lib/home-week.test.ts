import { describe, expect, it } from 'vitest';
import {
  buildWeekStrip,
  estimateWorkoutMinutes,
  greetingName,
  greetingPeriod,
  initialsFor,
  weekDayStatus,
} from './home-week';

const SP = 'America/Sao_Paulo';

describe('buildWeekStrip', () => {
  // Friday 2026-10-09, 20:00 in Sao Paulo (23:00 UTC).
  const now = new Date('2026-10-09T23:00:00Z');

  it('lists Monday to Sunday of the user week with today marked', () => {
    const days = buildWeekStrip({ now, timeZone: SP, trainedAt: [], plannedWeekdays: [] });
    expect(days.map((day) => day.key)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(days.map((day) => day.isoWeekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days.filter((day) => day.isToday).map((day) => day.key)).toEqual(['2026-10-09']);
  });

  it('marks trained days on the user calendar, not in UTC', () => {
    const days = buildWeekStrip({
      now,
      timeZone: SP,
      // Tuesday 22:30 in Sao Paulo is already Wednesday in UTC.
      trainedAt: [new Date('2026-10-07T01:30:00Z'), new Date('2026-10-05T12:00:00Z')],
      plannedWeekdays: [1, 3, 5],
    });
    const byKey = new Map(days.map((day) => [day.key, day]));
    expect(byKey.get('2026-10-06')?.trained).toBe(true);
    expect(byKey.get('2026-10-07')?.trained).toBe(false);
    expect(byKey.get('2026-10-05')?.trained).toBe(true);
    expect(days.filter((day) => day.planned).map((day) => day.isoWeekday)).toEqual([1, 3, 5]);
  });

  it('gives today first, then trained, then planned', () => {
    const [monday, tuesday, wednesday, , friday, saturday] = buildWeekStrip({
      now,
      timeZone: SP,
      trainedAt: [new Date('2026-10-05T12:00:00Z'), new Date('2026-10-09T12:00:00Z')],
      plannedWeekdays: [1, 3, 5],
    });
    expect(weekDayStatus(monday!)).toBe('trained');
    expect(weekDayStatus(tuesday!)).toBe('rest');
    expect(weekDayStatus(wednesday!)).toBe('planned');
    expect(weekDayStatus(friday!)).toBe('today');
    expect(weekDayStatus(saturday!)).toBe('rest');
  });

  it('starts the week on Monday when today is Sunday', () => {
    const sunday = new Date('2026-10-11T15:00:00Z');
    const days = buildWeekStrip({ now: sunday, timeZone: SP, trainedAt: [], plannedWeekdays: [] });
    expect(days[0]?.key).toBe('2026-10-05');
    expect(days[6]?.isToday).toBe(true);
  });
});

describe('greetingPeriod', () => {
  it('follows the user clock', () => {
    expect(greetingPeriod(new Date('2026-10-09T11:00:00Z'), SP)).toBe('morning'); // 08:00
    expect(greetingPeriod(new Date('2026-10-09T16:00:00Z'), SP)).toBe('afternoon'); // 13:00
    expect(greetingPeriod(new Date('2026-10-09T23:00:00Z'), SP)).toBe('evening'); // 20:00
    expect(greetingPeriod(new Date('2026-10-09T06:00:00Z'), SP)).toBe('evening'); // 03:00
  });
});

describe('estimateWorkoutMinutes', () => {
  it('adds work, rest and setup, rounded to 5 minutes', () => {
    // 3 x (40 + 180) + 60 = 720 s; 2 x 3 x (40 + 90) + 120 = 900 s -> 27 min -> 25.
    expect(
      estimateWorkoutMinutes([
        { targetSets: 3, restSec: 180 },
        { targetSets: 3, restSec: 90 },
        { targetSets: 3, restSec: 90 },
      ]),
    ).toBe(25);
  });

  it('is null for an empty workout and at least 5 otherwise', () => {
    expect(estimateWorkoutMinutes([])).toBeNull();
    expect(estimateWorkoutMinutes([{ targetSets: 1, restSec: 0 }])).toBe(5);
  });
});

describe('initialsFor and greetingName', () => {
  it('prefers the display name', () => {
    expect(initialsFor('Rafa Almeida', 'x@y.dev')).toBe('RA');
    expect(initialsFor('Rafa', 'x@y.dev')).toBe('RA');
    expect(greetingName('Rafa Almeida', 'x@y.dev')).toBe('Rafa');
  });

  it('falls back to the e-mail', () => {
    expect(initialsFor(null, 'pablo@example.com')).toBe('PA');
    expect(greetingName('  ', 'pablo@example.com')).toBe('pablo');
  });
});
