// Loads the deterministic weekly report (epic 2.6) of a lifter week (Monday
// to Sunday in the user's zone), against the week before: sets of finished
// sessions with their muscle contributions, records stored that week,
// bodyweight weigh-ins and the sessions the active program planned.

import { db } from '@/lib/db';
import { plannedSessionsPerWeek } from '@/lib/adherence';
import { effectiveWeight, isoWeekKey, isoWeekStart, weekStartBefore } from '@/lib/stats';
import { safeTimeZone } from '@/lib/timezone';
import { buildWeeklyReport, type WeeklyReport } from '@/lib/training-engine/weekly-report';
import { muscleContributions } from '@/lib/training-engine/volume';

const WEEK_KEY = /^(\d{4})-W(\d{2})$/;

// Monday (noon UTC) of an ISO week key such as "2026-W41", or null.
export function parseWeekKey(value: string | undefined | null): Date | null {
  const match = value?.match(WEEK_KEY);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  // Week 1 is the one with January 4th.
  const jan4 = Date.UTC(year, 0, 4, 12);
  const jan4Weekday = new Date(jan4).getUTCDay() || 7;
  const monday = new Date(jan4 - (jan4Weekday - 1) * 86_400_000 + (week - 1) * 7 * 86_400_000);
  return isoWeekKey(monday, 'UTC') === value ? monday : null;
}

export interface LoadedWeeklyReport {
  report: WeeklyReport;
  weekStart: Date;
  previousWeekKey: string;
  // Null for the current week (nothing after it yet).
  nextWeekKey: string | null;
  timeZone: string;
}

// The report of the week holding `week` (default: the last completed week).
export async function loadWeeklyReport(
  userId: string,
  week: Date | null,
  now: Date = new Date(),
): Promise<LoadedWeeklyReport> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true, bodyweight: true, weeklyFrequency: true },
  });
  const timeZone = safeTimeZone(user?.timezone);
  const currentWeekStart = isoWeekStart(now, timeZone);
  const requested = week ? isoWeekStart(week, timeZone) : null;
  const weekStart =
    requested && requested <= currentWeekStart
      ? requested
      : weekStartBefore(currentWeekStart, 1, timeZone);
  const previousWeekStart = weekStartBefore(weekStart, 1, timeZone);
  const weekEnd = weekStartBefore(weekStart, -1, timeZone);
  const inWeek = { gte: weekStart, lt: weekEnd };

  const [sets, sessionsDone, records, weighIns, program] = await Promise.all([
    db.set.findMany({
      where: {
        isWarmup: false,
        durationSec: null,
        exercise: { category: { not: 'CARDIO' } },
        session: {
          userId,
          finishedAt: { not: null },
          startedAt: { gte: previousWeekStart, lt: weekEnd },
        },
      },
      select: {
        exerciseId: true,
        weight: true,
        reps: true,
        rir: true,
        rpe: true,
        bodyweightKgSnapshot: true,
        session: { select: { startedAt: true } },
        exercise: {
          select: {
            name: true,
            muscleGroup: true,
            usesBodyweight: true,
            muscles: { select: { role: true, muscle: { select: { group: true } } } },
          },
        },
      },
    }),
    db.session.count({ where: { userId, finishedAt: { not: null }, startedAt: inWeek } }),
    db.personalRecord.count({ where: { userId, achievedAt: inWeek } }),
    db.bodyweightEntry.findMany({
      where: { userId, measuredAt: { gte: previousWeekStart, lt: weekEnd } },
      select: { weightKg: true, measuredAt: true },
    }),
    db.program.findFirst({
      where: { userId, isActive: true },
      select: { scheduleMode: true, workouts: { select: { dayOfWeek: true } } },
    }),
  ]);

  const report = buildWeeklyReport({
    weekKey: isoWeekKey(weekStart, timeZone),
    previousWeekKey: isoWeekKey(previousWeekStart, timeZone),
    sets: sets.map((set) => ({
      exerciseId: set.exerciseId,
      exerciseName: set.exercise.name,
      performedAt: set.session.startedAt,
      weight: effectiveWeight(
        set.weight,
        set.exercise.usesBodyweight,
        set.bodyweightKgSnapshot ?? user?.bodyweight,
      ),
      reps: set.reps,
      rir: set.rir,
      rpe: set.rpe,
      contributions: muscleContributions({
        muscleGroup: set.exercise.muscleGroup,
        muscles: set.exercise.muscles.map((m) => ({ role: m.role, group: m.muscle.group })),
      }),
    })),
    sessionsDone,
    sessionsPlanned:
      program && program.workouts.length > 0
        ? plannedSessionsPerWeek(program, user?.weeklyFrequency ?? null)
        : null,
    records,
    bodyweightKg: {
      week: weighIns.filter((w) => w.measuredAt >= weekStart).map((w) => w.weightKg),
      previousWeek: weighIns.filter((w) => w.measuredAt < weekStart).map((w) => w.weightKg),
    },
    timeZone,
  });

  return {
    report,
    weekStart,
    previousWeekKey: isoWeekKey(previousWeekStart, timeZone),
    nextWeekKey: weekStart < currentWeekStart ? isoWeekKey(weekEnd, timeZone) : null,
    timeZone,
  };
}
