// The training block since the last deload (epic 2.5): the latest deload the
// lifter took (DeloadPeriod) or the latest planned deload week of a program
// cycle they trained in, and the sessions since. Feeds the long-block arm of
// recommendDeload on the progress page, the dashboard insight and the coach.

import { db } from '@/lib/db';
import { trainingBlock, type TrainingBlock } from '@/lib/deload';
import { isoWeekKey } from '@/lib/stats';

// How far back a block is looked for: past this, it is long enough anyway.
const LOOKBACK_DAYS = 26 * 7;

export async function loadTrainingBlock(
  userId: string,
  now: Date,
  timeZone: string,
): Promise<TrainingBlock | null> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const [lastTaken, sessions] = await Promise.all([
    db.deloadPeriod.findFirst({
      where: { userId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
    db.session.findMany({
      where: { userId, finishedAt: { not: null }, startedAt: { gte: since } },
      select: {
        startedAt: true,
        cycleWeek: true,
        program: { select: { cycleDeloadWeek: true } },
      },
    }),
  ]);
  const lastPlanned = sessions
    .filter(
      (session) =>
        session.cycleWeek != null && session.cycleWeek === session.program?.cycleDeloadWeek,
    )
    .reduce<Date | null>(
      (latest, session) => (!latest || session.startedAt > latest ? session.startedAt : latest),
      null,
    );
  const candidates = [lastTaken?.startedAt ?? null, lastPlanned].filter(
    (date): date is Date => date != null,
  );
  const lastDeloadAt = candidates.length
    ? new Date(Math.max(...candidates.map((date) => date.getTime())))
    : null;

  return trainingBlock({
    lastDeloadAt,
    sessionStarts: sessions.map((session) => session.startedAt),
    now,
    weekKey: (date) => isoWeekKey(date, timeZone),
  });
}
