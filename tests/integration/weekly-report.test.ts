import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { loadWeeklyReport, parseWeekKey } from '@/lib/weekly-report';

// The weekly report (epic 2.6) of a lifter week against the week before, from
// stored sessions, records and weigh-ins.

describe('parseWeekKey', () => {
  it('maps an ISO week key to its Monday and rejects anything else', () => {
    expect(parseWeekKey('2026-W41')?.toISOString()).toBe('2026-10-05T12:00:00.000Z');
    expect(parseWeekKey('2026-W01')?.toISOString()).toBe('2025-12-29T12:00:00.000Z');
    expect(parseWeekKey('2026-W54')).toBeNull();
    expect(parseWeekKey('2026-41')).toBeNull();
    expect(parseWeekKey(undefined)).toBeNull();
  });
});

describe('loadWeeklyReport', () => {
  it('reports the requested week against the one before, in the user zone', async () => {
    const user = await db.user.create({
      data: { email: 'weekly-report@test.dev', passwordHash: 'x', timezone: 'UTC' },
    });
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const sessionOn = async (day: string, weight: number) => {
      const startedAt = new Date(`${day}T18:00:00Z`);
      const session = await db.session.create({
        data: { userId: user.id, startedAt, finishedAt: startedAt },
      });
      await db.set.createMany({
        data: [1, 2].map((setNumber) => ({
          sessionId: session.id,
          exerciseId: bench.id,
          setNumber,
          weight,
          reps: 5,
          rir: 2,
          completedAt: startedAt,
        })),
      });
      return session;
    };
    await sessionOn('2026-09-30', 90); // week 40
    const latest = await sessionOn('2026-10-07', 95); // week 41
    await db.personalRecord.create({
      data: {
        userId: user.id,
        sessionId: latest.id,
        exerciseId: bench.id,
        type: 'WEIGHT',
        value: 95,
        previousValue: 90,
        achievedAt: latest.startedAt,
      },
    });
    await db.bodyweightEntry.createMany({
      data: [
        { userId: user.id, weightKg: 80, measuredAt: new Date('2026-09-29T07:00:00Z') },
        { userId: user.id, weightKg: 79.4, measuredAt: new Date('2026-10-06T07:00:00Z') },
      ],
    });

    const { report, previousWeekKey, nextWeekKey } = await loadWeeklyReport(
      user.id,
      parseWeekKey('2026-W41'),
      new Date('2026-10-20T12:00:00Z'),
    );

    expect(previousWeekKey).toBe('2026-W40');
    expect(nextWeekKey).toBe('2026-W42');
    expect(report).toMatchObject({
      weekKey: '2026-W41',
      sessions: { done: 1, planned: null },
      workingSets: 2,
      effectiveSets: 2,
      tonnageKg: 950,
      records: 1,
      bodyweight: { averageKg: 79.4, previousAverageKg: 80 },
    });
    expect(report.muscles).toEqual([
      { group: 'CHEST', effectiveSets: 2, previous: 2, changePct: 0 },
    ]);
    expect(report.bestProgress).toMatchObject({ exerciseName: 'Bench', fromKg: 105, toKg: 110.8 });
  });

  it('defaults to the last completed week and never reports the future', async () => {
    const user = await db.user.create({
      data: { email: 'weekly-default@test.dev', passwordHash: 'x', timezone: 'UTC' },
    });
    const now = new Date('2026-10-09T12:00:00Z'); // week 41
    const defaulted = await loadWeeklyReport(user.id, null, now);
    expect(defaulted.report.weekKey).toBe('2026-W40');
    const future = await loadWeeklyReport(user.id, parseWeekKey('2027-W01'), now);
    expect(future.report.weekKey).toBe('2026-W40');
    const current = await loadWeeklyReport(user.id, parseWeekKey('2026-W41'), now);
    expect(current.report.weekKey).toBe('2026-W41');
    expect(current.nextWeekKey).toBeNull();
  });
});
