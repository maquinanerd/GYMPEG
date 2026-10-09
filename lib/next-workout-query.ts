// Server side of lib/next-workout: reads the history it needs (last workout
// finished in the program, workouts already done today in the user's zone).

import { db } from '@/lib/db';
import { getUserTimeZone } from '@/lib/user-timezone';
import { localDayKey, zonedIsoWeekday } from '@/lib/timezone';
import { nextWorkout, type NextWorkout, type ScheduleMode } from '@/lib/next-workout';

export interface ProgramForSchedule {
  id: string;
  scheduleMode: ScheduleMode;
  workouts: Array<{
    id: string;
    order: number;
    dayOfWeek: number | null;
    _count: { exercises: number };
  }>;
}

// A finished session counts for "today" if it started on today's local date;
// 36 hours back covers every time zone.
const TODAY_LOOKBACK_MS = 36 * 60 * 60 * 1000;

export async function suggestNextWorkout(
  userId: string,
  program: ProgramForSchedule,
  now: Date = new Date(),
): Promise<NextWorkout | null> {
  const timeZone = await getUserTimeZone(userId);
  const [last, recent] = await Promise.all([
    db.session.findFirst({
      where: { userId, programId: program.id, finishedAt: { not: null }, workoutId: { not: null } },
      orderBy: { startedAt: 'desc' },
      select: { workoutId: true },
    }),
    db.session.findMany({
      where: {
        userId,
        programId: program.id,
        finishedAt: { not: null },
        startedAt: { gte: new Date(now.getTime() - TODAY_LOOKBACK_MS) },
      },
      select: { workoutId: true, startedAt: true },
    }),
  ]);
  const today = localDayKey(now, timeZone);
  return nextWorkout({
    mode: program.scheduleMode,
    workouts: program.workouts.map((workout) => ({
      id: workout.id,
      order: workout.order,
      dayOfWeek: workout.dayOfWeek,
      exerciseCount: workout._count.exercises,
    })),
    lastWorkoutId: last?.workoutId ?? null,
    doneTodayIds: recent
      .filter((session) => session.workoutId && localDayKey(session.startedAt, timeZone) === today)
      .map((session) => session.workoutId!),
    today: zonedIsoWeekday(now, timeZone),
  });
}
