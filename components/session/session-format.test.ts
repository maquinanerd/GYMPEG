import { describe, expect, it } from 'vitest';
import { formatClock, formatRestLength, groupedSetsLine } from './session-format';

describe('formatClock', () => {
  it('reads mm:ss, then h:mm:ss past the hour, and never goes negative', () => {
    expect(formatClock(105)).toBe('01:45');
    expect(formatClock(3730)).toBe('1:02:10');
    expect(formatClock(-4)).toBe('00:00');
  });
});

describe('formatRestLength', () => {
  const t = (key: string, values: Record<string, number>) => `${key}:${JSON.stringify(values)}`;
  it('picks whole minutes, minutes and seconds, or seconds', () => {
    expect(formatRestLength(180, t)).toBe('minutes:{"count":3}');
    expect(formatRestLength(90, t)).toBe('minutesSeconds:{"minutes":1,"seconds":30}');
    expect(formatRestLength(45, t)).toBe('seconds:{"count":45}');
  });
});

describe('groupedSetsLine', () => {
  it('shares the load of consecutive sets and starts a group when it changes', () => {
    const load = (weight: number) => String(weight);
    expect(
      groupedSetsLine(
        [
          { weight: 80, reps: 10 },
          { weight: 80, reps: 9 },
          { weight: 80, reps: 8 },
        ],
        load,
      ),
    ).toBe('80 × 10 · 9 · 8');
    expect(
      groupedSetsLine(
        [
          { weight: 80, reps: 10 },
          { weight: 75, reps: 9 },
        ],
        load,
      ),
    ).toBe('80 × 10 · 75 × 9');
  });
});
