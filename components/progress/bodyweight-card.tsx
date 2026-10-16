'use client';

import { useCallback, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { TrashIcon } from '@/components/ui/icon';
import type { WeightUnit } from '@/lib/prisma-client';
import { Button, IconButton } from '@/components/ui/button';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Num } from '@/components/ui/num';
import { LineChart } from '@/components/progress/line-chart';
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
  // How many recent entries get a row in the log sheet.
  listLimit?: number;
}

const PERIODS = ['d7', 'd30', 'd90'] as const;

// Bodyweight (issue #99, epic 2.4, Corpo tab): the latest weigh-in as the big
// number with the 7-day average, its change over 7/30/90 days and the weekly
// pace, then a chart of each weigh-in (thin grey) under the 7-day average
// (ink). "Registrar" opens a sheet to log a weigh-in in the display unit and
// delete recent ones. The profile field in settings keeps working separately
// (corrections, not measurements).
export function BodyweightCard({ entries, trend, unit, listLimit = 5 }: Props) {
  const t = useTranslations('progress.bodyweight');
  const headingId = useId();
  const common = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
  const display = (kg: number) => roundWeight(toDisplayWeight(kg, unit), 1);

  // Chart, oldest to newest, in the display unit: each day's weigh-in with
  // its 7-day average when the trend is known, else the raw entries alone.
  const chart = trend
    ? {
        raw: trend.series.map((p) => display(p.weightKg)),
        average: trend.series.map((p) => display(p.averageKg)),
        start: trend.series[0] ? shortDay(trend.series[0].day) : '',
        end: trend.series.at(-1) ? shortDay(trend.series.at(-1)!.day) : '',
      }
    : {
        raw: [...entries].reverse().map((e) => display(e.weightKg)),
        average: null,
        start: entries.at(-1) ? shortDate(entries.at(-1)!.measuredAt) : '',
        end: entries[0] ? shortDate(entries[0].measuredAt) : '',
      };
  const points = chart.raw.length;

  const latest = entries[0];
  // Signed change without the unit (the big number carries it): "−0.4".
  const signed = (kg: number) => {
    const value = formatWeight(Math.abs(kg), unit, { locale, withUnit: false });
    return `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${value}`;
  };

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
      setOpen(false);
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
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="sr-only">
        {t('title')}
      </h2>
      {latest ? (
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[0.8125rem] font-medium text-muted-foreground">
              {trend?.averageKg != null
                ? t('headline', {
                    average: formatWeight(trend.averageKg, unit, { locale, withUnit: false }),
                  })
                : t('headlineNoAverage')}
            </span>
            <Num className="text-[2.25rem] leading-none" data-testid="bodyweight-current">
              {formatWeight(latest.weightKg, unit, { locale })}
            </Num>
          </div>
          <Button variant="ink" size="sm" onClick={() => setOpen(true)}>
            {t('log')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 py-2">
          <div className="flex flex-col gap-1">
            <p className="text-subtitle">{t('empty')}</p>
            <p className="text-caption text-muted-foreground">{t('emptyHint')}</p>
          </div>
          <Button variant="ink" size="sm" onClick={() => setOpen(true)}>
            {t('logWeight')}
          </Button>
        </div>
      )}

      {/* Change of the 7-day average and the weekly pace */}
      {trend?.averageKg != null && (
        <dl data-testid="bodyweight-trend" className="grid grid-cols-4 gap-2">
          {PERIODS.map((period) => {
            const change = trend.changeKg[period];
            return (
              <div key={period}>
                <dt className="text-small text-muted-foreground">{t(`periods.${period}`)}</dt>
                <dd className="mt-0.5">
                  <ChangeValue value={change == null ? null : signed(change)} unit={unitSuffix} />
                </dd>
              </div>
            );
          })}
          <div>
            <dt className="text-small text-muted-foreground">{t('rate')}</dt>
            <dd className="mt-0.5">
              <ChangeValue
                value={
                  trend.ratePerWeekKg == null
                    ? null
                    : t('perWeek', { rate: signed(trend.ratePerWeekKg) })
                }
              />
            </dd>
          </div>
        </dl>
      )}

      {/* Trend over the window */}
      {latest &&
        (points < 2 ? (
          <p className="text-caption text-muted-foreground">{t('second')}</p>
        ) : (
          <LineChart
            height={120}
            series={[
              { values: chart.raw, tone: 'raw' },
              ...(chart.average ? [{ values: chart.average, tone: 'ink' as const }] : []),
            ]}
            label={t('chartAria', {
              first: `${format.number(chart.raw[0]!)} ${unitSuffix}`,
              firstDate: chart.start,
              last: `${format.number(chart.raw[points - 1]!)} ${unitSuffix}`,
              lastDate: chart.end,
            })}
            startLabel={chart.start}
            endLabel={chart.end}
            formatTick={(v) => format.number(v)}
          />
        ))}

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetTitle>{t('sheetTitle')}</BottomSheetTitle>
          <BottomSheetDescription className="sr-only">
            {t('label', { unit: unitSuffix })}
          </BottomSheetDescription>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void addEntry();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="bodyweight-input">{t('label', { unit: unitSuffix })}</Label>
              <Input
                id="bodyweight-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder={latest ? String(display(latest.weightKg)) : undefined}
                value={weightField}
                onChange={(e) => setWeightField(e.target.value)}
              />
            </div>
            <Button type="submit" variant="ink" loading={busy}>
              {common('actions.save')}
            </Button>
          </form>

          {/* Recent weigh-ins, deletable */}
          {entries.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="text-caption font-semibold">{t('recent')}</h3>
              <ul>
                {entries.slice(0, listLimit).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-t border-border"
                  >
                    <span className="text-[0.8125rem] font-medium text-muted-foreground">
                      {shortDate(e.measuredAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Num stretch={112} className="text-[0.9375rem]">
                        {formatWeight(e.weightKg, unit, { locale })}
                      </Num>
                      <IconButton
                        type="button"
                        size="sm"
                        aria-label={t('deleteAria', { date: shortDate(e.measuredAt) })}
                        onClick={() => void deleteEntry(e.id)}
                        disabled={busy}
                      >
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </BottomSheetContent>
      </BottomSheet>
    </section>
  );
}

// A change in the trend row: the signed number without its unit (the big
// number above carries it), the unit kept for screen readers; a dash when
// there is not enough data yet.
function ChangeValue({ value, unit }: { value: string | null; unit?: string }) {
  const t = useTranslations('progress.bodyweight');
  if (value == null) {
    return (
      <span className="text-[0.9375rem] font-semibold text-muted-foreground">
        <span aria-hidden>–</span>
        <span className="sr-only">{t('noChange')}</span>
      </span>
    );
  }
  return (
    <Num stretch={112} className="text-[0.9375rem]">
      {value}
      {unit && <span className="sr-only"> {unit}</span>}
    </Num>
  );
}
