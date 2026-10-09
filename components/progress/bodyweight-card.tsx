'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Scale, Trash2 } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeightUnit } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatWeight,
  fromDisplayWeight,
  roundWeight,
  toDisplayWeight,
  unitLabel,
} from '@/lib/units';

// One bodyweight measurement, as serialized by the Server Component boundary.
export interface BodyweightEntryView {
  id: string;
  weightKg: number;
  measuredAt: string; // ISO
}

// The trend of lib/training-engine/body, computed on the server.
export interface BodyweightTrendView {
  averageKg: number | null;
  changeKg: { d7: number | null; d30: number | null; d90: number | null };
  ratePerWeekKg: number | null;
  // Daily values of the chart window, oldest first.
  series: { day: string; weightKg: number; averageKg: number }[];
}

interface Props {
  // Entries of the trend window, newest first.
  entries: BodyweightEntryView[];
  trend?: BodyweightTrendView;
  unit: WeightUnit;
  // How many recent entries get a row in the list below the chart.
  listLimit?: number;
}

const PERIODS = ['d7', 'd30', 'd90'] as const;

// Bodyweight trend card (issue #99, epic 2.4): quick-add a measurement in the
// display unit, the 7-day average and its change over 7/30/90 days, a chart of
// the daily weigh-ins with the average, and deletable recent entries. The
// profile field in settings keeps working separately (corrections, not
// measurements).
export function BodyweightCard({ entries, trend, unit, listLimit = 5 }: Props) {
  const t = useTranslations('progress.bodyweight');
  const common = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const [weightField, setWeightField] = useState('');
  const [busy, setBusy] = useState(false);

  const unitSuffix = unitLabel(unit);
  const shortDate = useCallback(
    (iso: string) => format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit' }),
    [format],
  );
  const shortDay = useCallback(
    (day: string) =>
      format.dateTime(new Date(`${day}T12:00:00Z`), {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
      }),
    [format],
  );

  // Chart data, oldest to newest, in the display unit: the daily values with
  // their 7-day average when the trend is known, else the raw entries.
  const chartData = useMemo(
    (): { label: string; weight: number; average?: number }[] =>
      trend
        ? trend.series.map((point) => ({
            label: shortDay(point.day),
            weight: roundWeight(toDisplayWeight(point.weightKg, unit), 1),
            average: roundWeight(toDisplayWeight(point.averageKg, unit), 1),
          }))
        : [...entries].reverse().map((e) => ({
            label: shortDate(e.measuredAt),
            weight: roundWeight(toDisplayWeight(e.weightKg, unit), 1),
            average: undefined,
          })),
    [entries, trend, unit, shortDate, shortDay],
  );

  const latest = entries[0];
  const signed = (kg: number) =>
    `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${formatWeight(Math.abs(kg), unit, { locale })}`;

  async function addEntry() {
    const weight = parseFloat(weightField);
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error(t('invalid'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/bodyweight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightKg: fromDisplayWeight(weight, unit) }),
      });
      if (!res.ok) {
        toast.error(t('logError'));
        return;
      }
      toast.success(t('logged'));
      setWeightField('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/bodyweight/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(t('deleteError'));
        return;
      }
      toast.success(t('deleted'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Scale className="size-4" />
            {t('title')}
          </h2>
          {latest && (
            <span className="text-sm text-muted-foreground">
              {t('current', { weight: formatWeight(latest.weightKg, unit, { locale }) })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Quick add, in the display unit */}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addEntry();
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="bodyweight-input">{t('label', { unit: unitSuffix })}</Label>
            <Input
              id="bodyweight-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder={
                latest ? String(roundWeight(toDisplayWeight(latest.weightKg, unit), 1)) : undefined
              }
              value={weightField}
              onChange={(e) => setWeightField(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? common('actions.saving') : t('log')}
          </Button>
        </form>

        {/* 7-day average and its change */}
        {trend?.averageKg != null && (
          <div data-testid="bodyweight-trend" className="flex flex-col gap-1 text-sm">
            <p className="font-medium">
              {t('average', { weight: formatWeight(trend.averageKg, unit, { locale }) })}
            </p>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              {PERIODS.map((period) => {
                const change = trend.changeKg[period];
                return (
                  <span key={period}>
                    {t('change', {
                      period: t(`periods.${period}`),
                      change: change == null ? t('noChange') : signed(change),
                    })}
                  </span>
                );
              })}
            </p>
            {trend.ratePerWeekKg != null && (
              <p className="text-muted-foreground">
                {t('rate', { rate: signed(trend.ratePerWeekKg) })}
              </p>
            )}
          </div>
        )}

        {/* Trend over the window */}
        {chartData.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            {chartData.length === 0 ? t('empty') : t('second')}
          </p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name={t('chartWeight', { unit: unitSuffix })}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  dot={{ r: 2 }}
                />
                {trend && (
                  <Line
                    type="monotone"
                    dataKey="average"
                    name={t('chartAverage', { unit: unitSuffix })}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent entries, deletable */}
        {entries.length > 0 && (
          <ul className="flex flex-col gap-1">
            {entries.slice(0, listLimit).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{formatWeight(e.weightKg, unit, { locale })}</span>{' '}
                  <span className="text-muted-foreground">
                    {t('onDate', { date: shortDate(e.measuredAt) })}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('deleteAria', { date: shortDate(e.measuredAt) })}
                  onClick={() => void deleteEntry(e.id)}
                  disabled={busy}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
