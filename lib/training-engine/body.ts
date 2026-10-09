// Body tracking (epic 2.4). Pure functions:
// - calculateWeightTrend: one value per day in the lifter's zone (the mean of
//   that day's weigh-ins), a trailing 7-day average that smooths water and
//   food swings, the change of that average over 7, 30 and 90 days and the
//   weekly rate over the last 30 days (least squares);
// - estimateBodyFatNavy: body fat % from tape measurements (U.S. Navy
//   circumference method). An estimate with a few points of error, shown as
//   such, never as a measurement.

import { localDayKey } from '@/lib/timezone';

export interface WeighIn {
  weightKg: number;
  measuredAt: Date;
}

export interface WeightTrendPoint {
  day: string; // YYYY-MM-DD in the lifter's zone
  weightKg: number; // mean of that day's weigh-ins
  averageKg: number; // trailing 7-day average ending that day
}

export interface WeightTrend {
  series: WeightTrendPoint[];
  // Latest 7-day average.
  averageKg: number | null;
  // Change of the 7-day average over the window; null without data that old.
  changeKg: { d7: number | null; d30: number | null; d90: number | null };
  // Weekly rate over the last 30 days (kg/week); null with too little data.
  ratePerWeekKg: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (value: number) => Math.round(value * 100) / 100;
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

export function calculateWeightTrend(
  entries: WeighIn[],
  options: { timeZone?: string } = {},
): WeightTrend {
  const timeZone = options.timeZone ?? 'UTC';
  const byDay = new Map<string, number[]>();
  for (const entry of entries) {
    if (!(entry.weightKg > 0)) continue;
    const day = localDayKey(entry.measuredAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), entry.weightKg]);
  }
  const days = [...byDay.entries()]
    .map(([day, weights]) => ({
      day,
      n: dayNumber(day),
      weightKg: weights.reduce((sum, w) => sum + w, 0) / weights.length,
    }))
    .sort((a, b) => a.n - b.n);

  const series: WeightTrendPoint[] = days.map((point) => {
    const window = days.filter((other) => other.n <= point.n && other.n > point.n - 7);
    return {
      day: point.day,
      weightKg: round2(point.weightKg),
      averageKg: round2(window.reduce((sum, other) => sum + other.weightKg, 0) / window.length),
    };
  });

  const latest = series.at(-1);
  if (!latest) {
    return {
      series,
      averageKg: null,
      changeKg: { d7: null, d30: null, d90: null },
      ratePerWeekKg: null,
    };
  }
  const latestN = dayNumber(latest.day);
  // The average on the last day with data at least `span` days before the latest.
  const changeOver = (span: number) => {
    const then = [...series].reverse().find((point) => dayNumber(point.day) <= latestN - span);
    return then ? round2(latest.averageKg - then.averageKg) : null;
  };

  // Least-squares slope of the daily values over the last 30 days.
  const recent = days.filter((point) => point.n > latestN - 30);
  let ratePerWeekKg: number | null = null;
  if (recent.length >= 2 && recent.at(-1)!.n - recent[0]!.n >= 7) {
    const meanX = recent.reduce((sum, p) => sum + p.n, 0) / recent.length;
    const meanY = recent.reduce((sum, p) => sum + p.weightKg, 0) / recent.length;
    const num = recent.reduce((sum, p) => sum + (p.n - meanX) * (p.weightKg - meanY), 0);
    const den = recent.reduce((sum, p) => sum + (p.n - meanX) ** 2, 0);
    ratePerWeekKg = den > 0 ? round2((num / den) * 7) : null;
  }

  return {
    series,
    averageKg: latest.averageKg,
    changeKg: { d7: changeOver(7), d30: changeOver(30), d90: changeOver(90) },
    ratePerWeekKg,
  };
}

// U.S. Navy circumference method (Hodgdon & Beckett), centimeters in. Returns
// the body fat % rounded to 0.1, or null when a measurement is missing, the
// sex is not male/female, or the inputs are implausible.
export function estimateBodyFatNavy(input: {
  sex: 'MALE' | 'FEMALE' | 'OTHER' | null | undefined;
  heightCm: number | null | undefined;
  waistCm: number | null | undefined;
  neckCm: number | null | undefined;
  hipsCm?: number | null;
}): number | null {
  const { sex, heightCm, waistCm, neckCm, hipsCm } = input;
  if (!heightCm || !waistCm || !neckCm || heightCm <= 0) return null;
  let percent: number;
  if (sex === 'MALE') {
    if (waistCm - neckCm <= 0) return null;
    percent =
      495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) -
      450;
  } else if (sex === 'FEMALE') {
    if (!hipsCm || waistCm + hipsCm - neckCm <= 0) return null;
    percent =
      495 /
        (1.29579 - 0.35004 * Math.log10(waistCm + hipsCm - neckCm) + 0.221 * Math.log10(heightCm)) -
      450;
  } else {
    return null;
  }
  if (!Number.isFinite(percent) || percent < 2 || percent > 70) return null;
  return Math.round(percent * 10) / 10;
}
