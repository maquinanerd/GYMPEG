import { describe, expect, it } from 'vitest';
import {
  calculateAdherence,
  calculateMuscleVolume,
  isEffectiveSet,
  muscleContributions,
  type VolumeSet,
} from './volume';

describe('muscleContributions', () => {
  it('counts the primary group fully and secondary muscles by half; stabilizers not at all', () => {
    expect(
      muscleContributions({
        muscleGroup: 'CHEST',
        muscles: [
          { role: 'PRIMARY', group: 'CHEST' },
          { role: 'SECONDARY', group: 'TRICEPS' },
          { role: 'SECONDARY', group: 'SHOULDERS_FRONT' },
          { role: 'STABILIZER', group: 'ABS' },
        ],
      }),
    ).toEqual([
      { group: 'CHEST', share: 1 },
      { group: 'TRICEPS', share: 0.5 },
      { group: 'SHOULDERS_FRONT', share: 0.5 },
    ]);
  });

  it('falls back to the exercise group and keeps the strongest role per group', () => {
    expect(muscleContributions({ muscleGroup: 'BICEPS' })).toEqual([{ group: 'BICEPS', share: 1 }]);
    expect(
      muscleContributions({
        muscleGroup: 'QUADS',
        muscles: [
          { role: 'SECONDARY', group: 'GLUTES' },
          { role: 'PRIMARY', group: 'GLUTES' },
        ],
      }),
    ).toEqual([
      { group: 'QUADS', share: 1 },
      { group: 'GLUTES', share: 1 },
    ]);
  });
});

describe('isEffectiveSet', () => {
  it('counts hard sets and unrated sets', () => {
    expect(isEffectiveSet({ rir: 2 })).toBe(true);
    expect(isEffectiveSet({ rir: 4 })).toBe(true);
    expect(isEffectiveSet({ rir: 5 })).toBe(false);
    expect(isEffectiveSet({ rpe: 6 })).toBe(true);
    expect(isEffectiveSet({ rpe: 5.5 })).toBe(false);
    expect(isEffectiveSet({})).toBe(true);
  });
});

describe('calculateMuscleVolume', () => {
  const bench = muscleContributions({
    muscleGroup: 'CHEST',
    muscles: [{ role: 'SECONDARY', group: 'TRICEPS' }],
  });
  const set = (day: string, rir: number | null, extra: Partial<VolumeSet> = {}): VolumeSet => ({
    weight: 100,
    reps: 5,
    rir,
    performedAt: new Date(`${day}T18:00:00Z`),
    contributions: bench,
    ...extra,
  });

  it('weighs sets per muscle, counts effective sets and distinct days per week', () => {
    const weeks = calculateMuscleVolume([
      set('2026-10-05', 2),
      set('2026-10-05', 5),
      set('2026-10-07', 1),
      set('2026-10-12', 2),
    ]);
    expect(weeks.map((week) => week.weekKey)).toEqual(['2026-W41', '2026-W42']);
    expect(weeks[0]!.byMuscleGroup).toEqual({
      CHEST: { sets: 3, effectiveSets: 2, volumeKg: 1500, days: 2 },
      TRICEPS: { sets: 1.5, effectiveSets: 1, volumeKg: 750, days: 2 },
    });
  });

  it("buckets by the lifter's week, not UTC", () => {
    // Sunday 23:30 in Sao Paulo is Monday 02:30 UTC.
    const sunday = set('2026-10-12', 2, { performedAt: new Date('2026-10-12T02:30:00Z') });
    expect(calculateMuscleVolume([sunday], { timeZone: 'America/Sao_Paulo' })[0]!.weekKey).toBe(
      '2026-W41',
    );
    expect(calculateMuscleVolume([sunday])[0]!.weekKey).toBe('2026-W42');
  });
});

describe('calculateAdherence', () => {
  it('compares sessions and prescribed sets with what was done, capped at the plan', () => {
    expect(
      calculateAdherence({
        sessionsPlanned: 4,
        sessions: [
          { prescribedSets: 15, workingSets: 15 },
          { prescribedSets: 15, workingSets: 9 },
          { prescribedSets: 12, workingSets: 20 },
        ],
      }),
    ).toEqual({
      sessionsDone: 3,
      sessionsPlanned: 4,
      setsDone: 36,
      setsPrescribed: 42,
      sessionRatio: 0.75,
      setRatio: 0.86,
    });
  });

  it('never divides by zero or rewards doing more than planned', () => {
    expect(calculateAdherence({ sessionsPlanned: 0, sessions: [] })).toMatchObject({
      sessionRatio: 0,
      setRatio: 0,
    });
    expect(
      calculateAdherence({
        sessionsPlanned: 2,
        sessions: Array(3).fill({ prescribedSets: 1, workingSets: 1 }),
      }),
    ).toMatchObject({ sessionRatio: 1, setRatio: 1 });
  });
});
