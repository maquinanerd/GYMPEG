// Pure derivations behind the home screen (design round 1): the week strip,
// the greeting and the duration estimate of the next workout. No I/O; the
// page loads the rows and formats the labels.

import { localCalendarDate, localDayKey, zonedParts } from '@/lib/timezone';

export type WeekDayStatus = 'today' | 'trained' | 'planned' | 'rest';

export interface WeekStripDay {
  // 'YYYY-MM-DD' on the user's calendar.
  key: string;
  // ISO weekday, 1 = Monday ... 7 = Sunday (the Workout.dayOfWeek convention).
  isoWeekday: number;
  // Noon of that calendar day in UTC fields: safe to format with timeZone UTC.
  date: Date;
  isToday: boolean;
  trained: boolean;
  planned: boolean;
}

const DAY_MS = 86_400_000;

// Monday to Sunday of the week holding `now`, on the user's calendar. A day is
// trained when a finished session started on it; planned when the program
// schedules a workout on that weekday (fixed-days programs only: a rotation
// has no weekday to show).
export function buildWeekStrip(input: {
  now: Date;
  timeZone: string;
  trainedAt: Date[];
  plannedWeekdays: Iterable<number>;
}): WeekStripDay[] {
  const today = localCalendarDate(input.now, input.timeZone);
  const isoToday = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
  const monday = today.getTime() - (isoToday - 1) * DAY_MS;
  const trained = new Set(input.trainedAt.map((date) => localDayKey(date, input.timeZone)));
  const planned = new Set(input.plannedWeekdays);
  const todayKey = localDayKey(input.now, input.timeZone);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday + index * DAY_MS + DAY_MS / 2);
    const key = date.toISOString().slice(0, 10);
    const isoWeekday = index + 1;
    return {
      key,
      isoWeekday,
      date,
      isToday: key === todayKey,
      trained: trained.has(key),
      planned: planned.has(isoWeekday),
    };
  });
}

// What the day pill says, in priority order: today, trained, planned, rest.
export function weekDayStatus(day: WeekStripDay): WeekDayStatus {
  if (day.isToday) return 'today';
  if (day.trained) return 'trained';
  if (day.planned) return 'planned';
  return 'rest';
}

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

// "Bom dia" until noon, "Boa tarde" until 18h, "Boa noite" after, on the
// user's clock.
export function greetingPeriod(now: Date, timeZone: string): GreetingPeriod {
  const { hour } = zonedParts(now, timeZone);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

// Rough time under the bar for one working set, and the setup of a new
// exercise (walk, load, warm-up singles).
export const SET_WORK_SEC = 40;
export const EXERCISE_SETUP_SEC = 60;

// Estimated duration of a workout in minutes, rounded to 5: every set is its
// work plus its programmed rest, every exercise adds its setup. Explainable
// and good enough for "~60 min"; null for an empty workout.
export function estimateWorkoutMinutes(
  exercises: { targetSets: number; restSec: number }[],
): number | null {
  const seconds = exercises.reduce(
    (sum, exercise) =>
      sum + exercise.targetSets * (SET_WORK_SEC + exercise.restSec) + EXERCISE_SETUP_SEC,
    0,
  );
  if (seconds <= 0) return null;
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

// Two-letter initials for the avatar: first and last words of the name, else
// the first two letters of the e-mail's local part.
export function initialsFor(displayName: string | null | undefined, email: string): string {
  const words = (displayName ?? '').trim().split(/\s+/u).filter(Boolean);
  if (words.length >= 2) {
    return (Array.from(words[0]!)[0]! + Array.from(words.at(-1)!)[0]!).toUpperCase();
  }
  if (words.length === 1) return Array.from(words[0]!).slice(0, 2).join('').toUpperCase();
  return Array.from(email.split('@')[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// The name in the greeting: the first word of the display name, else the
// e-mail's local part.
export function greetingName(displayName: string | null | undefined, email: string): string {
  const first = (displayName ?? '').trim().split(/\s+/u)[0];
  return first || (email.split('@')[0] ?? email);
}
