// Which workout of the active program comes next (epic 1.6). Pure: the
// caller passes the program's workouts, the last workout finished in it and
// today's weekday in the user's time zone.
//
// - ROTATION: the workout after the last one done, in program order, cycling
//   (A, B, C, A...). Missed days do not matter: the sequence just continues.
// - FIXED_DAYS: the workout scheduled today; once done (or on a day with
//   nothing scheduled) the next scheduled day's workout. A program in this
//   mode with no day set anywhere behaves as a rotation.
// Workouts without exercises are never suggested.

export type ScheduleMode = 'ROTATION' | 'FIXED_DAYS';

export interface ScheduleWorkout {
  id: string;
  order: number;
  dayOfWeek: number | null; // 1 = Monday ... 7 = Sunday
  exerciseCount: number;
}

export type NextWorkout =
  | { kind: 'rotation'; workoutId: string; afterWorkoutId: string | null }
  | { kind: 'today'; workoutId: string }
  | { kind: 'upcoming'; workoutId: string; dayOfWeek: number; inDays: number };

export function nextWorkout(input: {
  mode: ScheduleMode;
  workouts: ScheduleWorkout[];
  lastWorkoutId: string | null;
  // Workouts already finished today (local calendar day).
  doneTodayIds: string[];
  today: number; // ISO weekday, 1 = Monday
}): NextWorkout | null {
  const runnable = input.workouts
    .filter((workout) => workout.exerciseCount > 0)
    .sort((a, b) => a.order - b.order);
  if (runnable.length === 0) return null;

  const scheduled = runnable.filter((workout) => workout.dayOfWeek != null);
  if (input.mode === 'FIXED_DAYS' && scheduled.length > 0) {
    const done = new Set(input.doneTodayIds);
    const todays = scheduled.find(
      (workout) => workout.dayOfWeek === input.today && !done.has(workout.id),
    );
    if (todays) return { kind: 'today', workoutId: todays.id };
    for (let inDays = 1; inDays <= 7; inDays += 1) {
      const dayOfWeek = ((input.today - 1 + inDays) % 7) + 1;
      const upcoming = scheduled.find((workout) => workout.dayOfWeek === dayOfWeek);
      if (upcoming) return { kind: 'upcoming', workoutId: upcoming.id, dayOfWeek, inDays };
    }
  }

  const lastIndex = runnable.findIndex((workout) => workout.id === input.lastWorkoutId);
  const next = runnable[(lastIndex + 1) % runnable.length]!;
  return {
    kind: 'rotation',
    workoutId: next.id,
    afterWorkoutId: lastIndex >= 0 ? runnable[lastIndex]!.id : null,
  };
}
