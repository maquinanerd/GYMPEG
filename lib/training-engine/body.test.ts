import { describe, expect, it } from 'vitest';
import { calculateWeightTrend, estimateBodyFatNavy } from './body';

const at = (day: string, weightKg: number, hour = 8) => ({
  weightKg,
  measuredAt: new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`),
});

describe('calculateWeightTrend', () => {
  it('is empty without weigh-ins', () => {
    expect(calculateWeightTrend([])).toEqual({
      series: [],
      averageKg: null,
      changeKg: { d7: null, d30: null, d90: null },
      ratePerWeekKg: null,
    });
  });

  it('averages a day and smooths over 7 days', () => {
    const trend = calculateWeightTrend([
      at('2026-10-01', 80),
      at('2026-10-01', 81, 20),
      at('2026-10-03', 79),
      at('2026-10-09', 78),
    ]);
    expect(trend.series).toEqual([
      { day: '2026-10-01', weightKg: 80.5, averageKg: 80.5 },
      { day: '2026-10-03', weightKg: 79, averageKg: 79.75 },
      // 10-03 is 6 days back: still inside the window; 10-01 is not.
      { day: '2026-10-09', weightKg: 78, averageKg: 78.5 },
    ]);
    expect(trend.averageKg).toBe(78.5);
    expect(trend.changeKg).toEqual({ d7: -2, d30: null, d90: null });
  });

  it('measures change over 30 and 90 days and the weekly rate', () => {
    // Losing 0.1 kg per day for 100 days.
    const entries = Array.from({ length: 101 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10);
      return at(day, 90 - i * 0.1);
    });
    const trend = calculateWeightTrend(entries);
    expect(trend.changeKg.d30).toBeCloseTo(-3, 5);
    expect(trend.changeKg.d90).toBeCloseTo(-9, 5);
    expect(trend.ratePerWeekKg).toBeCloseTo(-0.7, 5);
  });

  it("uses the lifter's day, not UTC", () => {
    // 23:30 in Sao Paulo on the 1st is 02:30 UTC on the 2nd.
    const trend = calculateWeightTrend([at('2026-10-02', 80, 2)], {
      timeZone: 'America/Sao_Paulo',
    });
    expect(trend.series[0]!.day).toBe('2026-10-01');
  });
});

describe('estimateBodyFatNavy', () => {
  it('estimates men from waist, neck and height', () => {
    expect(
      estimateBodyFatNavy({ sex: 'MALE', heightCm: 178, waistCm: 85, neckCm: 38 }),
    ).toBeCloseTo(16.6, 0);
  });

  it('needs the hips for women', () => {
    expect(
      estimateBodyFatNavy({ sex: 'FEMALE', heightCm: 165, waistCm: 72, neckCm: 33 }),
    ).toBeNull();
    const value = estimateBodyFatNavy({
      sex: 'FEMALE',
      heightCm: 165,
      waistCm: 72,
      neckCm: 33,
      hipsCm: 98,
    });
    expect(value).toBeGreaterThan(20);
    expect(value).toBeLessThan(35);
  });

  it('says nothing without the inputs or with implausible ones', () => {
    expect(
      estimateBodyFatNavy({ sex: 'OTHER', heightCm: 170, waistCm: 80, neckCm: 36 }),
    ).toBeNull();
    expect(
      estimateBodyFatNavy({ sex: 'MALE', heightCm: null, waistCm: 80, neckCm: 36 }),
    ).toBeNull();
    expect(estimateBodyFatNavy({ sex: 'MALE', heightCm: 170, waistCm: 30, neckCm: 36 })).toBeNull();
  });
});
