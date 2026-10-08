import { describe, expect, it } from 'vitest';
import {
  isValidTimeZone,
  localCalendarDate,
  localDayKey,
  safeTimeZone,
  timeZoneOffsetMs,
  zonedStartOfDay,
} from './timezone';

const HOUR = 3_600_000;

describe('time zone validation', () => {
  it('accepts IANA zones and rejects junk', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });

  it('falls back to UTC for unknown or empty values', () => {
    expect(safeTimeZone('Europe/Lisbon')).toBe('Europe/Lisbon');
    expect(safeTimeZone('nope')).toBe('UTC');
    expect(safeTimeZone(null)).toBe('UTC');
  });
});

describe('local calendar', () => {
  it('puts a Sunday-night Sao Paulo session on Sunday, not Monday', () => {
    const sundayNight = new Date('2026-10-12T01:30:00Z'); // Sun 11 Oct, 22:30 in Sao Paulo
    expect(localDayKey(sundayNight, 'America/Sao_Paulo')).toBe('2026-10-11');
    expect(localDayKey(sundayNight, 'UTC')).toBe('2026-10-12');
    expect(localCalendarDate(sundayNight, 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-11T00:00:00.000Z',
    );
  });

  it('reports the zone offset', () => {
    expect(timeZoneOffsetMs(new Date('2026-10-08T12:00:00Z'), 'America/Sao_Paulo')).toBe(
      -3 * HOUR,
    );
    expect(timeZoneOffsetMs(new Date('2026-10-08T12:00:00Z'), 'Asia/Tokyo')).toBe(9 * HOUR);
  });
});

describe('zonedStartOfDay', () => {
  it('returns local midnight as an instant', () => {
    expect(zonedStartOfDay(2026, 10, 12, 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-12T03:00:00.000Z',
    );
    expect(zonedStartOfDay(2026, 10, 12, 'UTC').toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });

  it('handles DST transitions (New York, spring forward and fall back)', () => {
    // 2026-03-08: clocks jump 02:00 -> 03:00; midnight is still EST (UTC-5).
    expect(zonedStartOfDay(2026, 3, 8, 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    // The next day starts in EDT (UTC-4).
    expect(zonedStartOfDay(2026, 3, 9, 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
    // 2026-11-01: clocks fall back 02:00 -> 01:00; midnight is EDT.
    expect(zonedStartOfDay(2026, 11, 1, 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
  });

  it('handles a DST gap at midnight (Santiago, Chile)', () => {
    // Chile springs forward at 00:00 -> 01:00 local on the first Sunday of
    // September 2026 (6 Sep); the day starts at 01:00 local (UTC-3).
    const start = zonedStartOfDay(2026, 9, 6, 'America/Santiago');
    expect(localDayKey(start, 'America/Santiago')).toBe('2026-09-06');
    expect(localDayKey(new Date(start.getTime() - 1), 'America/Santiago')).toBe('2026-09-05');
  });
});
