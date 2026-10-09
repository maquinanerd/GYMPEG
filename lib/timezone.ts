// Calendar math in the user's time zone. Weeks, streaks, "today" and record
// dates must follow the user's wall clock: in UTC, a Sunday 22:00 session in
// Sao Paulo (UTC-3) would land on Monday and in the next training week.
//
// Pure functions over Intl (no dependency); an IANA zone name is the only
// input. 'UTC' keeps the historical behavior.

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// Falls back to UTC for anything Intl does not know, so a bad stored value can
// never crash an aggregation.
export function safeTimeZone(value: string | null | undefined): string {
  return value && isValidTimeZone(value) ? value : 'UTC';
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  if (timeZone === 'UTC') {
    // Fast path: aggregations call this once per set.
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

// Offset of the zone from UTC at that instant, in ms (Sao Paulo: -3h).
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// 'YYYY-MM-DD' of the instant on the zone's calendar.
export function localDayKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// The instant at which the given calendar day starts in the zone. On a DST
// gap at midnight the day starts at the first existing instant after it.
export function zonedStartOfDay(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let instant = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  // A second pass settles days where the offset changes between the guess and
  // the real midnight (DST transitions).
  instant = guess - timeZoneOffsetMs(new Date(instant), timeZone);
  const parts = zonedParts(new Date(instant), timeZone);
  if (parts.day !== day) {
    // Landed on the previous day's evening (gap at midnight): move forward.
    instant += 60 * 60 * 1000;
  }
  return new Date(instant);
}

// A Date whose UTC fields equal the zone's calendar date (time 00:00). Lets
// UTC-based calendar code (ISO weeks) run on the user's local date.
export function localCalendarDate(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

// ISO weekday of the instant on the zone's calendar: 1 = Monday ... 7 =
// Sunday (the convention of Workout.dayOfWeek).
export function zonedIsoWeekday(date: Date, timeZone: string): number {
  const day = localCalendarDate(date, timeZone).getUTCDay();
  return day === 0 ? 7 : day;
}
