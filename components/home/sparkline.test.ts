import { describe, expect, it } from 'vitest';
import { sparkline } from './sparkline';

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 8));

describe('sparkline', () => {
  it('needs at least two weigh-ins', () => {
    expect(sparkline([], { width: 112, height: 40 })).toBeNull();
    expect(sparkline([{ at: day(1), kg: 78 }], { width: 112, height: 40 })).toBeNull();
  });

  it('places points by date, oldest on the left, heaviest on top', () => {
    const line = sparkline(
      [
        { at: day(11), kg: 78 },
        { at: day(1), kg: 79 },
        { at: day(6), kg: 78.5 },
      ],
      { width: 112, height: 40, inset: 2 },
    )!;
    expect(line.points).toBe('2,2 56,20 110,38');
    expect(line.end).toEqual({ x: 110, y: 38 });
  });

  it('keeps a flat series in the middle instead of zooming into noise', () => {
    const line = sparkline(
      [
        { at: day(1), kg: 80 },
        { at: day(2), kg: 80 },
      ],
      { width: 100, height: 40, inset: 0 },
    )!;
    expect(line.points).toBe('0,20 100,20');
  });

  it('does not blow a 0.1 kg wobble up to the full height', () => {
    const line = sparkline(
      [
        { at: day(1), kg: 80.1 },
        { at: day(2), kg: 80 },
      ],
      { width: 100, height: 60, inset: 0 },
    )!;
    const ys = line.points.split(' ').map((pair) => Number(pair.split(',')[1]));
    expect(Math.abs(ys[1]! - ys[0]!)).toBeLessThan(15);
  });
});
