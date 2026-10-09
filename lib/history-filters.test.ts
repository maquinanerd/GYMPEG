import { describe, expect, it } from 'vitest';
import {
  hasHistoryFilters,
  historySessionWhere,
  parseHistoryFilters,
  setHistoryFilterParams,
} from './history-filters';

describe('parseHistoryFilters', () => {
  it('keeps well-formed ids and known muscle groups', () => {
    expect(
      parseHistoryFilters({
        programId: 'cm1program',
        gymId: 'cm1gym',
        exerciseId: 'cm1exercise',
        muscle: 'CHEST',
      }),
    ).toEqual({
      programId: 'cm1program',
      gymId: 'cm1gym',
      exerciseId: 'cm1exercise',
      muscle: 'CHEST',
    });
  });

  it('drops malformed values instead of passing them on', () => {
    expect(
      parseHistoryFilters({ programId: "x' OR 1=1", gymId: '', exerciseId: null, muscle: 'NECK' }),
    ).toEqual({});
  });
});

describe('historySessionWhere', () => {
  it('only reads finished sessions of the user', () => {
    expect(historySessionWhere('user-1', {})).toEqual({
      userId: 'user-1',
      finishedAt: { not: null },
    });
  });

  it('narrows by program, gym, and sessions with a working set of the exercise or muscle', () => {
    const range = { gte: new Date(0), lt: new Date(1) };
    expect(
      historySessionWhere(
        'user-1',
        { programId: 'p', gymId: 'g', exerciseId: 'e', muscle: 'QUADS' },
        range,
      ),
    ).toEqual({
      userId: 'user-1',
      finishedAt: { not: null },
      startedAt: range,
      programId: 'p',
      gymId: 'g',
      sets: { some: { isWarmup: false, exerciseId: 'e', exercise: { muscleGroup: 'QUADS' } } },
    });
  });
});

describe('setHistoryFilterParams', () => {
  it('writes the active filters and removes the others', () => {
    const params = new URLSearchParams('month=2026-10&gymId=old&muscle=CHEST');

    setHistoryFilterParams(params, { programId: 'p', muscle: 'BICEPS' });

    expect(params.toString()).toBe('month=2026-10&muscle=BICEPS&programId=p');
    expect(hasHistoryFilters({})).toBe(false);
    expect(hasHistoryFilters({ gymId: 'g' })).toBe(true);
  });
});
