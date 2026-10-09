import type { Set } from '@/lib/prisma-client';
import { localCalendarDate, localDayKey, zonedStartOfDay } from '@/lib/timezone';
import { isCardioSet } from '@/lib/cardio';
import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';

// ============================================================
// Training stats - volume, estimated 1RM, weekly aggregation
// ============================================================
// Cardio sets (issue #133): a set with durationSec != null is conditioning
// work (stored as weight = 0 / reps = 1 by convention). It carries no
// meaningful load, so every aggregation here skips it explicitly - tonnage,
// e1RM, per-session progress points and the weekly volume/set-count
// landmarks all describe lifting only. The `durationSec` field is optional
// on the input types so strength-only callers are unchanged.

// Set-like input that may carry the cardio marker.
type MaybeCardio = { durationSec?: number | null };

// ============================================================
// Bodyweight: effective tonnage on bodyweight exercises
// ============================================================

// Effective load of a set: for `usesBodyweight` exercises, we add the user's
// bodyweight. `setWeight` remains the entered value (added load, or negative
// for assistance). If the user has not filled in their bodyweight, we return
// setWeight as-is (backward-safe).
export function effectiveWeight(
  setWeight: number,
  exerciseUsesBodyweight: boolean,
  bodyweight: number | null | undefined,
): number {
  if (exerciseUsesBodyweight && bodyweight && bodyweight > 0) {
    return +(bodyweight + setWeight).toFixed(2);
  }
  return setWeight;
}

// Enriches a list of sets with their effective load. The sets must be
// decorated beforehand with `usesBodyweight` (typically copied from
// `set.exercise.usesBodyweight` in the Server Component). We avoid mutating,
// returning a new list instead.
export function applyBodyweight<T extends { weight: number; usesBodyweight?: boolean | null }>(
  sets: T[],
  bodyweight: number | null | undefined,
): T[] {
  if (!bodyweight || bodyweight <= 0) return sets;
  return sets.map((s) =>
    s.usesBodyweight ? { ...s, weight: +(bodyweight + s.weight).toFixed(2) } : s,
  );
}

// Volume of a set = load × reps. For bodyweight (weight = 0),
// we return 0 by convention (impossible to compare with a load).
// Cardio sets carry no tonnage and always count 0.
export function setVolume(set: Pick<Set, 'weight' | 'reps' | 'isWarmup'> & MaybeCardio): number {
  if (set.isWarmup || isCardioSet(set)) return 0;
  return set.weight * set.reps;
}

// Total volume of a list of sets (sum, excluding warmups and cardio).
export function totalVolume(
  sets: (Pick<Set, 'weight' | 'reps' | 'isWarmup'> & MaybeCardio)[],
): number {
  return sets.reduce((acc, s) => acc + setVolume(s), 0);
}

// Estimated 1RM via the Epley formula: weight × (1 + reps / 30).
// Returns 0 for sets at 0 kg (bodyweight not comparable).
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// Estimated load for `targetReps` reps, from one performed set: the Epley
// formula inverted around estimate1RM, so a set maps back to its own weight
// when targetReps equals its reps. Returns 0 when there is nothing to
// estimate from (no load, no reps) or no target.
export function estimateRepMax(weight: number, reps: number, targetReps: number): number {
  if (targetReps <= 0) return 0;
  return estimate1RM(weight, reps) / (1 + targetReps / 30);
}

// Best estimated 1RM over a list of sets (warmups and drop sets included
// since they are technically valid for estimating strength). Cardio sets
// are skipped: they have no load to estimate from.
export function best1RM(sets: (Pick<Set, 'weight' | 'reps' | 'isWarmup'> & MaybeCardio)[]): number {
  let best = 0;
  for (const s of sets) {
    if (s.isWarmup || isCardioSet(s)) continue;
    const e = estimate1RM(s.weight, s.reps);
    if (e > best) best = e;
  }
  return best;
}

// ============================================================
// ISO week (Monday-Sunday) - key YYYY-Www, label "W{w} YYYY"
// ============================================================

// Returns the ISO key of a date in the "YYYY-Www" format (week starting Monday).
// The calendar day is read in `timeZone` (default UTC), never in the host's
// local time, so bucketing is identical on every server (issue #160). Pass the
// user's zone so a Sunday-night session stays in its own week.
export function isoWeekKey(date: Date, timeZone: string = 'UTC'): string {
  const d = localCalendarDate(date, timeZone);
  // Thursday of the current week (ISO: the week belongs to the year its Thursday falls in).
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Instant at which the ISO week containing the given date starts: Monday
// 00:00 in `timeZone` (default UTC), like isoWeekKey above.
export function isoWeekStart(date: Date, timeZone: string = 'UTC'): Date {
  const d = localCalendarDate(date, timeZone);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return zonedStartOfDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), timeZone);
}

// Calendar options shared by the aggregations below: the user's IANA time
// zone. Defaults to UTC (the historical behavior).
export interface CalendarOptions {
  timeZone?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Start of the ISO week `weeks` weeks before `weekStart` (negative = after).
// Computed from noon of the shifted day so a DST change never lands it in the
// wrong week.
export function weekStartBefore(weekStart: Date, weeks: number, timeZone: string): Date {
  return isoWeekStart(new Date(weekStart.getTime() - weeks * 7 * DAY_MS + DAY_MS / 2), timeZone);
}

// ============================================================
// Aggregations
// ============================================================

export interface ExerciseChartPoint {
  date: string; // ISO date (YYYY-MM-DD) of the session
  sessionStartedAt: Date;
  maxWeight: number;
  topSetReps: number; // reps of the best set (max weight)
  estimated1RM: number;
  totalVolume: number;
}

// For an exercise, aggregates each session into a progression point.
// Input: sets ordered by session, with sessionStartedAt joined.
export function exerciseProgress(
  sets: (Pick<Set, 'weight' | 'reps' | 'isWarmup'> &
    MaybeCardio & { sessionId: string; sessionStartedAt: Date })[],
  options: CalendarOptions = {},
): ExerciseChartPoint[] {
  const timeZone = options.timeZone ?? 'UTC';
  const bySession = new Map<string, { startedAt: Date; sets: typeof sets }>();
  for (const s of sets) {
    if (s.isWarmup || isCardioSet(s)) continue;
    const entry = bySession.get(s.sessionId);
    if (entry) {
      entry.sets.push(s);
    } else {
      bySession.set(s.sessionId, { startedAt: s.sessionStartedAt, sets: [s] });
    }
  }
  const points: ExerciseChartPoint[] = [];
  for (const [, { startedAt, sets: sessionSets }] of bySession) {
    if (sessionSets.length === 0) continue;
    const maxWeight = Math.max(...sessionSets.map((s) => s.weight));
    const topReps = Math.max(
      ...sessionSets.filter((s) => s.weight === maxWeight).map((s) => s.reps),
    );
    points.push({
      date: localDayKey(startedAt, timeZone),
      sessionStartedAt: startedAt,
      maxWeight,
      topSetReps: topReps,
      estimated1RM: +estimate1RM(maxWeight, topReps).toFixed(1),
      totalVolume: totalVolume(sessionSets),
    });
  }
  return points.sort((a, b) => a.sessionStartedAt.getTime() - b.sessionStartedAt.getTime());
}

// ============================================================
// Stalled-lift detection (flat / declining e1RM over recent sessions)
// ============================================================

// How many of the most recent sessions to judge a stall over. A lift is
// flagged when, across these sessions, the best estimated 1RM never improves
// on the prior best (within tolerance). Defined once so it lives in one place.
export const STALL_LOOKBACK_SESSIONS = TRAINING_GUIDELINE.stallLookbackSessions;

// Relative tolerance: an e1RM counts as an improvement only when it exceeds the
// prior best by more than this fraction (0.5%). Keeps rounding/noise from
// masking a genuine plateau.
export const STALL_TOLERANCE = TRAINING_GUIDELINE.stallTolerance;

// The stall window must also span this many days (epic 2.5): three sessions
// in one week say little about a plateau.
export const STALL_MIN_SPAN_DAYS = TRAINING_GUIDELINE.stallMinSpanDays;

// Stall test over exerciseProgress points (dated, oldest first): the e1RM
// test below, over a window of sessions that also spans STALL_MIN_SPAN_DAYS.
export function isStalledOverTime(
  points: { date: string; estimated1RM: number }[],
  lookback: number = STALL_LOOKBACK_SESSIONS,
  minSpanDays: number = STALL_MIN_SPAN_DAYS,
): boolean {
  if (points.length < lookback) return false;
  const window = points.slice(-lookback);
  const spanDays =
    (Date.parse(`${window.at(-1)!.date}T00:00:00Z`) - Date.parse(`${window[0]!.date}T00:00:00Z`)) /
    (24 * 60 * 60 * 1000);
  if (!(spanDays >= minSpanDays)) return false;
  return isStalled(
    points.map((point) => point.estimated1RM),
    lookback,
  );
}

// Pure stall test over an exercise's per-session best-e1RM series (oldest ->
// newest). Returns true when, over the last `lookback` sessions, no session
// improves on the best e1RM seen before that window (and within the window).
// Never flags with fewer than `lookback` sessions (insufficient data).
export function isStalled(
  e1rmSeries: number[],
  lookback: number = STALL_LOOKBACK_SESSIONS,
): boolean {
  if (lookback < 2) return false;
  if (e1rmSeries.length < lookback) return false;

  const windowStart = e1rmSeries.length - lookback;
  // Best e1RM established strictly before the lookback window. With no prior
  // history (window covers the whole series), the first window entry is the
  // baseline the rest must beat.
  let bestBefore = 0;
  for (let i = 0; i < windowStart; i++) {
    if (e1rmSeries[i]! > bestBefore) bestBefore = e1rmSeries[i]!;
  }

  let baseline = windowStart === 0 ? e1rmSeries[0]! : bestBefore;
  const startIdx = windowStart === 0 ? 1 : windowStart;

  for (let i = startIdx; i < e1rmSeries.length; i++) {
    const value = e1rmSeries[i]!;
    // Improvement = strictly above the running best, beyond tolerance.
    if (value > baseline * (1 + STALL_TOLERANCE)) {
      return false;
    }
    if (value > baseline) baseline = value;
  }
  return true;
}

export interface WeeklyVolumePoint {
  weekKey: string; // YYYY-Www
  weekStart: Date; // Monday 00:00 UTC
  // Volume per muscle group (kg). Absent groups count as 0.
  byMuscleGroup: Record<string, number>;
  total: number;
}

// Aggregates the weekly volume by muscle group.
// Input: non-warmup sets with their muscle group and the session date.
export function weeklyVolumeByMuscleGroup(
  sets: (Pick<Set, 'weight' | 'reps' | 'isWarmup'> &
    MaybeCardio & {
      muscleGroup: string;
      sessionStartedAt: Date;
    })[],
  options: CalendarOptions = {},
): WeeklyVolumePoint[] {
  const timeZone = options.timeZone ?? 'UTC';
  const byWeek = new Map<string, WeeklyVolumePoint>();
  for (const s of sets) {
    if (s.isWarmup || isCardioSet(s)) continue;
    const key = isoWeekKey(s.sessionStartedAt, timeZone);
    let entry = byWeek.get(key);
    if (!entry) {
      entry = {
        weekKey: key,
        weekStart: isoWeekStart(s.sessionStartedAt, timeZone),
        byMuscleGroup: {},
        total: 0,
      };
      byWeek.set(key, entry);
    }
    const v = setVolume(s);
    entry.byMuscleGroup[s.muscleGroup] = (entry.byMuscleGroup[s.muscleGroup] ?? 0) + v;
    entry.total += v;
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

// ============================================================
// Volume landmarks (weekly working sets per muscle group)
// ============================================================

// Default volume landmarks, expressed in weekly working (non-warmup) sets per
// muscle group. These are general hypertrophy heuristics (renaissance-
// periodization style), not medical truth: a single conservative band applied
// uniformly to every muscle group. They are intended as adjustable reference
// defaults so a user can gauge whether a week sits below, within, or above the
// productive range.
//
// - MEV (minimum effective volume): the floor below which growth stimulus is
//   typically too low to drive progress.
// - MRV (maximum recoverable volume): the ceiling above which fatigue tends to
//   outpace recovery.
export const WEEKLY_SETS_MEV = TRAINING_GUIDELINE.weeklySetsMEV;
export const WEEKLY_SETS_MRV = TRAINING_GUIDELINE.weeklySetsMRV;

// A resolved MEV/MRV band for one muscle group, plus whether it came from the
// user's own VolumeTarget (issue #211) or the global defaults above.
export interface VolumeBand {
  mev: number;
  mrv: number;
  custom: boolean;
}

// Resolves the band to apply for a muscle group: the user's per-muscle target
// when one is set, else the global defaults. Pure: the caller passes the
// already-loaded targets map (muscleGroup -> { mev, mrv }), so classification
// stays free of any DB access. A target is honored only when it is internally
// consistent (mev >= 1 and mrv > mev), matching the Zod input bounds, so a
// hand-tampered row can never produce an inverted band.
export function resolveVolumeBand(
  muscleGroup: string,
  targets?: Record<string, { mev: number; mrv: number }>,
): VolumeBand {
  const t = targets?.[muscleGroup];
  if (t && t.mev >= 1 && t.mrv > t.mev) {
    return { mev: t.mev, mrv: t.mrv, custom: true };
  }
  return { mev: WEEKLY_SETS_MEV, mrv: WEEKLY_SETS_MRV, custom: false };
}

// Where a weekly working-set count falls relative to the MEV/MRV band.
export type VolumeLandmarkZone = 'BELOW_MEV' | 'WITHIN' | 'ABOVE_MRV';

// Classifies a weekly working-set count against the band. The band is inclusive
// at both bounds: counts < MEV are below, counts > MRV are above, and the
// MEV..MRV range (endpoints included) is within. Defaults are overridable.
export function classifyWeeklySets(
  sets: number,
  mev: number = WEEKLY_SETS_MEV,
  mrv: number = WEEKLY_SETS_MRV,
): VolumeLandmarkZone {
  if (sets < mev) return 'BELOW_MEV';
  if (sets > mrv) return 'ABOVE_MRV';
  return 'WITHIN';
}

export interface WeeklySetsPoint {
  weekKey: string; // YYYY-Www
  weekStart: Date; // Monday 00:00 UTC
  // Working-set count per muscle group. Absent groups count as 0.
  byMuscleGroup: Record<string, number>;
  total: number;
}

// Aggregates the weekly working-set count by muscle group. Mirrors
// `weeklyVolumeByMuscleGroup` (same ISO-week bucketing and non-warmup filter),
// but counts sets instead of summing load × reps. Display-only: this feeds the
// MEV/MRV reference band and does not influence progression or coach logic.
export function weeklySetsByMuscleGroup(
  sets: (Pick<Set, 'isWarmup'> &
    MaybeCardio & {
      muscleGroup: string;
      sessionStartedAt: Date;
    })[],
  options: CalendarOptions = {},
): WeeklySetsPoint[] {
  const timeZone = options.timeZone ?? 'UTC';
  const byWeek = new Map<string, WeeklySetsPoint>();
  for (const s of sets) {
    if (s.isWarmup || isCardioSet(s)) continue;
    const key = isoWeekKey(s.sessionStartedAt, timeZone);
    let entry = byWeek.get(key);
    if (!entry) {
      entry = {
        weekKey: key,
        weekStart: isoWeekStart(s.sessionStartedAt, timeZone),
        byMuscleGroup: {},
        total: 0,
      };
      byWeek.set(key, entry);
    }
    entry.byMuscleGroup[s.muscleGroup] = (entry.byMuscleGroup[s.muscleGroup] ?? 0) + 1;
    entry.total += 1;
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

export interface WeeklyFrequencyPoint {
  weekKey: string; // YYYY-Www
  weekStart: Date; // Monday 00:00 UTC
  // Distinct training days per muscle group in the week (calendar days, UTC,
  // with >= 1 working set hitting that group). Absent groups count as 0.
  byMuscleGroup: Record<string, number>;
}

// Aggregates the weekly training FREQUENCY by muscle group (issue #225):
// the number of DISTINCT calendar days (UTC) in each ISO week on which the
// muscle group received at least one working set. Mirrors
// `weeklySetsByMuscleGroup` (same ISO-week bucketing, same warmup + cardio
// exclusion) so the frequency reads consistently with the volume card, but
// counts distinct days rather than sets - two sets the same day count once,
// two different days count twice. Display-only: never feeds progression or
// coach logic.
export function weeklyFrequencyByMuscleGroup(
  sets: (Pick<Set, 'isWarmup'> &
    MaybeCardio & {
      muscleGroup: string;
      sessionStartedAt: Date;
    })[],
  options: CalendarOptions = {},
): WeeklyFrequencyPoint[] {
  const timeZone = options.timeZone ?? 'UTC';
  interface Bucket {
    weekStart: Date;
    // muscleGroup -> set of UTC calendar-day strings (YYYY-MM-DD).
    days: Map<string, globalThis.Set<string>>;
  }
  const byWeek = new Map<string, Bucket>();
  for (const s of sets) {
    if (s.isWarmup || isCardioSet(s)) continue;
    const key = isoWeekKey(s.sessionStartedAt, timeZone);
    let entry = byWeek.get(key);
    if (!entry) {
      entry = { weekStart: isoWeekStart(s.sessionStartedAt, timeZone), days: new Map() };
      byWeek.set(key, entry);
    }
    const day = localDayKey(s.sessionStartedAt, timeZone);
    let groupDays = entry.days.get(s.muscleGroup);
    if (!groupDays) {
      groupDays = new globalThis.Set<string>();
      entry.days.set(s.muscleGroup, groupDays);
    }
    groupDays.add(day);
  }
  return [...byWeek.entries()]
    .map(([weekKey, entry]) => ({
      weekKey,
      weekStart: entry.weekStart,
      byMuscleGroup: Object.fromEntries(
        [...entry.days.entries()].map(([group, days]) => [group, days.size]),
      ),
    }))
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

// ============================================================
// Conditioning (weekly cardio minutes / distance / sessions)
// ============================================================

// WHO guideline for moderate aerobic activity, rendered as a display-only
// reference line on the conditioning card (issue #135).
export const WEEKLY_CONDITIONING_TARGET_MIN = 150;

export interface ConditioningWeekPoint {
  weekKey: string; // YYYY-Www
  weekStart: Date; // Monday 00:00 UTC
  minutes: number; // total cardio duration, rounded to whole minutes
  distanceKm: number; // total distance, km with 2 decimals (0 when none)
  sessions: number; // distinct sessions containing >= 1 cardio set
}

// Pure weekly aggregation of cardio sets (issue #135, display-only). Returns
// exactly `windowWeeks` ISO weeks ending at the week of `now` (zero-filled,
// oldest first) so the chart timeline has no gaps. Input: non-warmup cardio
// sets (durationSec != null) with their session id and start date; non-cardio
// sets are ignored defensively.
export function weeklyConditioning(
  sets: {
    durationSec?: number | null;
    distanceM?: number | null;
    isWarmup: boolean;
    sessionId: string;
    sessionStartedAt: Date;
  }[],
  options: { windowWeeks?: number; now?: Date } & CalendarOptions = {},
): ConditioningWeekPoint[] {
  const windowWeeks = options.windowWeeks ?? 8;
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? 'UTC';

  interface Bucket {
    seconds: number;
    meters: number;
    sessionIds: globalThis.Set<string>;
  }
  const byWeek = new Map<string, Bucket>();
  for (const s of sets) {
    if (s.isWarmup || !isCardioSet(s)) continue;
    const key = isoWeekKey(s.sessionStartedAt, timeZone);
    let bucket = byWeek.get(key);
    if (!bucket) {
      bucket = { seconds: 0, meters: 0, sessionIds: new globalThis.Set<string>() };
      byWeek.set(key, bucket);
    }
    bucket.seconds += s.durationSec ?? 0;
    bucket.meters += s.distanceM ?? 0;
    bucket.sessionIds.add(s.sessionId);
  }

  // Zero-filled window: the current ISO week and the (windowWeeks - 1) before.
  const currentWeekStart = isoWeekStart(now, timeZone);
  const points: ConditioningWeekPoint[] = [];
  for (let i = windowWeeks - 1; i >= 0; i--) {
    const weekStart = weekStartBefore(currentWeekStart, i, timeZone);
    const weekKey = isoWeekKey(weekStart, timeZone);
    const bucket = byWeek.get(weekKey);
    points.push({
      weekKey,
      weekStart,
      minutes: bucket ? Math.round(bucket.seconds / 60) : 0,
      distanceKm: bucket ? +(bucket.meters / 1000).toFixed(2) : 0,
      sessions: bucket ? bucket.sessionIds.size : 0,
    });
  }
  return points;
}

export interface ConditioningDayPoint {
  date: string; // YYYY-MM-DD, UTC calendar day
  minutes: number; // total cardio duration that day, rounded to whole minutes
  km: number; // total distance that day, km with 2 decimals (0 when none)
}

// Pure DAILY aggregation of cardio sets over the current ISO week (issue
// #153): the interference signal for the coach - WHEN the cardio happened,
// not just how much. Same rules as weeklyConditioning (non-warmup cardio
// sets only; non-cardio sets ignored defensively), bucketed by UTC calendar
// day of the session start. Days without cardio are OMITTED rather than
// zero-filled: the payload stays compact (a zero-cardio week is an empty
// array) and the dates make gaps unambiguous to the model.
export function dailyConditioning(
  sets: {
    durationSec?: number | null;
    distanceM?: number | null;
    isWarmup: boolean;
    sessionStartedAt: Date;
  }[],
  options: { now?: Date } & CalendarOptions = {},
): ConditioningDayPoint[] {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? 'UTC';
  const weekStart = isoWeekStart(now, timeZone);
  const weekEnd = weekStartBefore(weekStart, -1, timeZone);

  const byDay = new Map<string, { seconds: number; meters: number }>();
  for (const s of sets) {
    if (s.isWarmup || !isCardioSet(s)) continue;
    if (s.sessionStartedAt < weekStart || s.sessionStartedAt >= weekEnd) continue;
    const day = localDayKey(s.sessionStartedAt, timeZone);
    let bucket = byDay.get(day);
    if (!bucket) {
      bucket = { seconds: 0, meters: 0 };
      byDay.set(day, bucket);
    }
    bucket.seconds += s.durationSec ?? 0;
    bucket.meters += s.distanceM ?? 0;
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      minutes: Math.round(bucket.seconds / 60),
      km: +(bucket.meters / 1000).toFixed(2),
    }));
}

// ============================================================
// Training consistency (per-week trained days + current streak)
// ============================================================

export interface ConsistencyWeek {
  weekKey: string; // YYYY-Www
  weekStartIso: string; // Monday 00:00 UTC, ISO string
  trainedDays: number; // distinct calendar days with >=1 finished session
  onStreak: boolean; // meets the streak rule (>=1 day, or the target when set)
  isCurrent: boolean; // the ISO week that contains `now`
}

export interface ConsistencySummary {
  weeks: ConsistencyWeek[]; // oldest -> newest, exactly `windowWeeks` entries
  currentStreak: number; // consecutive on-streak weeks ending at the current week
  weeklyFrequency: number | null; // the target used (echoed back), null when none
}

// Pure derivation of training consistency from finished sessions.
//
// - Buckets the `windowWeeks` most recent ISO weeks (ending at the week of
//   `now`), counting distinct calendar days that have at least one finished
//   session (multiple sessions on the same day count once).
// - A week is "on streak" when it has at least one trained day, or meets the
//   `weeklyFrequency` target when one is provided.
// - `currentStreak` is the run of consecutive on-streak weeks ending at the
//   current week. The current week is partial: if it has not yet met the rule,
//   it does not break the streak (it simply does not extend it), so the streak
//   is measured from the most recent completed-or-met week backwards.
export function trainingConsistency(
  finishedSessionDates: Date[],
  options: {
    weeklyFrequency?: number | null;
    windowWeeks?: number;
    now?: Date;
  } & CalendarOptions = {},
): ConsistencySummary {
  const windowWeeks = options.windowWeeks ?? 12;
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? 'UTC';
  const weeklyFrequency =
    options.weeklyFrequency != null && options.weeklyFrequency > 0 ? options.weeklyFrequency : null;

  // Distinct trained calendar days per ISO week key. (`Set` from @prisma/client
  // shadows the global Set type here, so reference it via globalThis.)
  const daysByWeek = new Map<string, globalThis.Set<string>>();
  for (const date of finishedSessionDates) {
    const weekKey = isoWeekKey(date, timeZone);
    const dayKey = localDayKey(date, timeZone);
    let days = daysByWeek.get(weekKey);
    if (!days) {
      days = new globalThis.Set<string>();
      daysByWeek.set(weekKey, days);
    }
    days.add(dayKey);
  }

  // Build the window: the current ISO week and the (windowWeeks - 1) before it.
  const currentWeekStart = isoWeekStart(now, timeZone);
  const currentWeekKey = isoWeekKey(now, timeZone);
  const weeks: ConsistencyWeek[] = [];
  for (let i = windowWeeks - 1; i >= 0; i--) {
    const weekStart = weekStartBefore(currentWeekStart, i, timeZone);
    const weekKey = isoWeekKey(weekStart, timeZone);
    const trainedDays = daysByWeek.get(weekKey)?.size ?? 0;
    const onStreak = weeklyFrequency ? trainedDays >= weeklyFrequency : trainedDays >= 1;
    weeks.push({
      weekKey,
      weekStartIso: weekStart.toISOString(),
      trainedDays,
      onStreak,
      isCurrent: weekKey === currentWeekKey,
    });
  }

  // Count the streak backwards from the newest week. The current (partial) week
  // not yet on streak is skipped rather than breaking the run.
  let currentStreak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const week = weeks[i]!;
    if (week.onStreak) {
      currentStreak++;
    } else if (week.isCurrent) {
      // Partial current week with no qualifying training yet: do not break.
      continue;
    } else {
      break;
    }
  }

  return { weeks, currentStreak, weeklyFrequency };
}
