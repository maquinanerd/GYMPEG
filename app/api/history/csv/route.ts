import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { csvEscape, HISTORY_CSV_HEADERS } from '@/lib/csv';
import { effectiveWeight, estimate1RM, setVolume } from '@/lib/stats';
import { historySessionWhere, parseHistoryFilters } from '@/lib/history-filters';
import { DEFAULT_TIME_ZONE, localDayKey, safeTimeZone, zonedStartOfDay } from '@/lib/timezone';

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

// GET /api/history/csv?programId=&gymId=&exerciseId=&muscle=&month=YYYY-MM
// Returns a CSV (UTF-8 + BOM for Excel) with one row per set (warmups
// included, flagged by is_warmup). Same filters as the /history page; with an
// exercise or muscle filter only that exercise's/muscle's rows are exported.
// The month (optional) and the `date` column follow the user's time zone.
// The GymCoach CSV import (app/api/import/gymcoach/route.ts, issue #270) is
// the symmetric inverse of this export.
export async function GET(req: Request) {
  try {
    const userId = await requireApiUserId();
    const url = new URL(req.url);
    const filters = parseHistoryFilters(Object.fromEntries(url.searchParams));
    const monthMatch = url.searchParams.get('month')?.match(MONTH_PATTERN);
    const month = monthMatch ? monthMatch[0] : null;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { bodyweight: true, timezone: true },
    });
    const timeZone = safeTimeZone(user?.timezone ?? DEFAULT_TIME_ZONE);
    const bodyweight = user?.bodyweight ?? null;

    let range: { gte: Date; lt: Date } | undefined;
    if (monthMatch) {
      const y = Number(monthMatch[1]);
      const m = Number(monthMatch[2]);
      if (m >= 1 && m <= 12) {
        range = {
          gte: zonedStartOfDay(y, m, 1, timeZone),
          lt: zonedStartOfDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1, timeZone),
        };
      }
    }

    // The userId scope is pinned by the cross-user case in
    // tests/integration/route-ownership.test.ts.
    const sessions = await db.session.findMany({
      where: historySessionWhere(userId, filters, range),
      orderBy: { startedAt: 'asc' },
      include: {
        program: { select: { name: true } },
        workout: { select: { name: true } },
        sets: {
          where: {
            ...(filters.exerciseId ? { exerciseId: filters.exerciseId } : {}),
            ...(filters.muscle ? { exercise: { muscleGroup: filters.muscle } } : {}),
          },
          orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
          include: {
            exercise: {
              select: { name: true, muscleGroup: true, usesBodyweight: true },
            },
          },
        },
      },
    });

    const lines: string[] = [HISTORY_CSV_HEADERS.join(',')];

    for (const s of sessions) {
      const durationMin =
        s.finishedAt && s.startedAt
          ? Math.round((s.finishedAt.getTime() - s.startedAt.getTime()) / 60000)
          : '';
      const dateOnly = localDayKey(s.startedAt, timeZone);
      for (const set of s.sets) {
        const eff = effectiveWeight(set.weight, set.exercise.usesBodyweight, bodyweight);
        const effSet = { weight: eff, reps: set.reps, isWarmup: set.isWarmup };
        const row = [
          s.id,
          dateOnly,
          s.startedAt.toISOString(),
          s.finishedAt?.toISOString() ?? '',
          String(durationMin),
          s.program?.name ?? '',
          s.workout?.name ?? '',
          set.exercise.name,
          set.exercise.muscleGroup,
          set.exercise.usesBodyweight ? 'true' : 'false',
          String(set.setNumber),
          String(set.weight),
          String(eff),
          String(set.reps),
          set.rir != null ? String(set.rir) : '',
          set.isWarmup ? 'true' : 'false',
          set.isDropSet ? 'true' : 'false',
          String(setVolume(effSet)),
          set.isWarmup ? '' : estimate1RM(eff, set.reps).toFixed(2),
          set.notes ?? '',
          // Cardio columns (issue #144): raw storage units, empty on strength sets.
          set.durationSec != null ? String(set.durationSec) : '',
          set.distanceM != null ? String(set.distanceM) : '',
          // Heart-rate columns (issue #203): bpm, empty on strength sets and on
          // cardio logged without a heart-rate reading.
          set.avgHr != null ? String(set.avgHr) : '',
          set.maxHr != null ? String(set.maxHr) : '',
        ];
        lines.push(row.map(csvEscape).join(','));
      }
    }

    // UTF-8 BOM so Excel detects the encoding and displays accents correctly.
    const body = '﻿' + lines.join('\n');
    const filename = buildFilename(month, filters.programId ?? null, timeZone);
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

function buildFilename(month: string | null, programId: string | null, timeZone: string): string {
  const parts = ['gymcoach-history'];
  if (month) parts.push(month);
  if (programId) parts.push(`prog-${programId.slice(0, 8)}`);
  if (parts.length === 1) parts.push(localDayKey(new Date(), timeZone));
  return parts.join('-') + '.csv';
}
