import { describe, expect, it } from 'vitest';
import { TRAINING_GUIDELINE } from './guideline';
import { muscleContributions } from './volume';
import { buildWeeklyReport, type ReportSet } from './weekly-report';

const bench = muscleContributions({
  muscleGroup: 'CHEST',
  muscles: [{ role: 'SECONDARY', group: 'TRICEPS' }],
});
const squat = muscleContributions({ muscleGroup: 'QUADS' });

const set = (
  day: string,
  exercise: 'bench' | 'squat',
  weight: number,
  reps: number,
  rir: number | null = 2,
): ReportSet => ({
  exerciseId: exercise,
  exerciseName: exercise === 'bench' ? 'Bench' : 'Squat',
  performedAt: new Date(`${day}T18:00:00Z`),
  weight,
  reps,
  rir,
  contributions: exercise === 'bench' ? bench : squat,
});

describe('buildWeeklyReport', () => {
  const previousWeek = [
    set('2026-09-29', 'bench', 90, 5),
    set('2026-09-29', 'bench', 90, 5),
    set('2026-09-30', 'squat', 120, 5),
    set('2026-09-30', 'squat', 120, 5),
  ];
  const week = [
    set('2026-10-06', 'bench', 95, 5),
    set('2026-10-06', 'bench', 95, 5),
    set('2026-10-06', 'bench', 60, 10, 6), // too easy: not an effective set
    set('2026-10-08', 'squat', 120, 5),
  ];

  const report = buildWeeklyReport({
    weekKey: '2026-W41',
    previousWeekKey: '2026-W40',
    sets: [...previousWeek, ...week],
    sessionsDone: 2,
    sessionsPlanned: 3,
    records: 1,
    bodyweightKg: { week: [80, 79.6], previousWeek: [80.4] },
    timeZone: 'UTC',
  });

  it('adds up the week from the engine', () => {
    expect(report).toMatchObject({
      weekKey: '2026-W41',
      sessions: { done: 2, planned: 3 },
      workingSets: 4,
      effectiveSets: 3,
      tonnageKg: 95 * 5 * 2 + 600 + 600,
      records: 1,
      bodyweight: { averageKg: 79.8, previousAverageKg: 80.4 },
      guidelineVersion: TRAINING_GUIDELINE.version,
    });
  });

  it('compares effective sets per muscle with the week before', () => {
    expect(report.muscles).toEqual([
      { group: 'CHEST', effectiveSets: 2, previous: 2, changePct: 0 },
      { group: 'QUADS', effectiveSets: 1, previous: 2, changePct: -50 },
      { group: 'TRICEPS', effectiveSets: 1, previous: 1, changePct: 0 },
    ]);
  });

  it('names the lift whose estimated 1RM grew the most', () => {
    expect(report.bestProgress).toEqual({
      exerciseId: 'bench',
      exerciseName: 'Bench',
      fromKg: 105,
      toKg: 110.8,
    });
  });

  it('has no progress or bodyweight line without the data', () => {
    const quiet = buildWeeklyReport({
      weekKey: '2026-W41',
      previousWeekKey: '2026-W40',
      sets: week,
      sessionsDone: 1,
      sessionsPlanned: null,
      records: 0,
      bodyweightKg: { week: [], previousWeek: [] },
      timeZone: 'UTC',
    });
    expect(quiet.bestProgress).toBeNull();
    expect(quiet.bodyweight).toBeNull();
    expect(quiet.muscles.find((muscle) => muscle.group === 'CHEST')?.changePct).toBeNull();
  });
});
