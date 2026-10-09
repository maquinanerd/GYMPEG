// Mesocycle (epic 1.6): a program can repeat over a cycle of N weeks, one of
// which is a planned deload. Pure: the caller passes the program's cycle,
// the instant and the user's time zone.
//
// Weeks are calendar weeks (Monday to Sunday) on the user's local calendar,
// counted from the anchor: the Monday that started week 1. Setting "I am in
// week k now" moves the anchor; the cycle then repeats forever.
//
// In the deload week every prescription is lighter: half the sets (at least
// one) and two more reps in reserve (at most 5). The load step-down comes
// from the progression engine's planned-deload rule (lib/progression).

import { localCalendarDate, zonedStartOfDay } from '@/lib/timezone';

export const MIN_CYCLE_WEEKS = 2;
export const MAX_CYCLE_WEEKS = 12;
export const DELOAD_SETS_FACTOR = 0.5;
export const DELOAD_RIR_OFFSET = 2;
const MAX_RIR = 5;
const DAY_MS = 86_400_000;

export interface ProgramCycle {
  weeks: number;
  deloadWeek: number | null;
  anchor: Date;
}

// The cycle of a program row, or null when it has none.
export function programCycle(program: {
  cycleWeeks: number | null;
  cycleDeloadWeek: number | null;
  cycleAnchor: Date | string | null;
}): ProgramCycle | null {
  if (!program.cycleWeeks || !program.cycleAnchor) return null;
  return {
    weeks: program.cycleWeeks,
    deloadWeek: program.cycleDeloadWeek,
    anchor: new Date(program.cycleAnchor),
  };
}

// Days between two instants on the zone's calendar (b - a).
function calendarDaysBetween(a: Date, b: Date, timeZone: string): number {
  return Math.round(
    (localCalendarDate(b, timeZone).getTime() - localCalendarDate(a, timeZone).getTime()) / DAY_MS,
  );
}

// Week of the cycle (1..weeks) the instant falls in.
export function cycleWeekAt(cycle: ProgramCycle, at: Date, timeZone: string): number {
  const weekIndex = Math.floor(calendarDaysBetween(cycle.anchor, at, timeZone) / 7);
  return (((weekIndex % cycle.weeks) + cycle.weeks) % cycle.weeks) + 1;
}

export function isDeloadWeek(cycle: ProgramCycle, week: number): boolean {
  return cycle.deloadWeek === week;
}

// The anchor that makes `now` fall in week `currentWeek`: the local Monday of
// the current week, moved back (currentWeek - 1) weeks.
export function anchorForCurrentWeek(currentWeek: number, now: Date, timeZone: string): Date {
  const today = localCalendarDate(now, timeZone); // UTC fields = local date
  const isoWeekday = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
  const monday = new Date(
    today.getTime() - (isoWeekday - 1) * DAY_MS - (currentWeek - 1) * 7 * DAY_MS,
  );
  return zonedStartOfDay(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    timeZone,
  );
}

// A prescription as the deload week runs it.
export function deloadPrescription<T extends { targetSets: number; targetRIR: number }>(
  prescription: T,
): T {
  return {
    ...prescription,
    targetSets: Math.max(1, Math.round(prescription.targetSets * DELOAD_SETS_FACTOR)),
    targetRIR: Math.min(MAX_RIR, prescription.targetRIR + DELOAD_RIR_OFFSET),
  };
}

// The prescriptions of a workout for the given week of the cycle.
export function prescriptionsForWeek<T extends { targetSets: number; targetRIR: number }>(
  rows: T[],
  cycle: ProgramCycle | null,
  week: number | null,
): T[] {
  if (!cycle || week == null || !isDeloadWeek(cycle, week)) return rows;
  return rows.map(deloadPrescription);
}
