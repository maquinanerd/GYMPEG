// Weekly adherence to the active program (epic 2.3): the sessions the plan
// expects this week (fixed weekdays, or the weekly frequency the lifter set
// for a rotation) and the prescribed working sets of the sessions done, in
// the lifter's week. The ratios come from the pure engine.

import { db } from '@/lib/db';
import { deloadPrescription, isDeloadWeek, programCycle } from '@/lib/program-cycle';
import { isoWeekStart } from '@/lib/stats';
import { calculateAdherence, type Adherence } from '@/lib/training-engine/volume';

export async function weeklyAdherence(
  userId: string,
  program: {
    id: string;
    scheduleMode: 'ROTATION' | 'FIXED_DAYS';
    cycleWeeks: number | null;
    cycleDeloadWeek: number | null;
    cycleAnchor: Date | null;
    workouts: { id: string; dayOfWeek: number | null }[];
  },
  options: { now: Date; timeZone: string; weeklyFrequency: number | null },
): Promise<Adherence> {
  const sessionsPlanned =
    program.scheduleMode === 'FIXED_DAYS'
      ? program.workouts.filter((workout) => workout.dayOfWeek != null).length
      : (options.weeklyFrequency ?? program.workouts.length);

  const sessions = await db.session.findMany({
    where: {
      userId,
      programId: program.id,
      finishedAt: { not: null },
      startedAt: { gte: isoWeekStart(options.now, options.timeZone) },
    },
    select: {
      cycleWeek: true,
      _count: { select: { sets: { where: { isWarmup: false } } } },
      workout: { select: { exercises: { select: { targetSets: true, targetRIR: true } } } },
    },
  });
  const cycle = programCycle(program);
  return calculateAdherence({
    sessionsPlanned,
    sessions: sessions.map((session) => {
      const deload =
        cycle != null && session.cycleWeek != null && isDeloadWeek(cycle, session.cycleWeek);
      const rows = session.workout?.exercises ?? [];
      return {
        prescribedSets: rows.reduce(
          (sum, row) => sum + (deload ? deloadPrescription(row) : row).targetSets,
          0,
        ),
        workingSets: session._count.sets,
      };
    }),
  });
}
