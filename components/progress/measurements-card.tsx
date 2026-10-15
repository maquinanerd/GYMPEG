'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { TrashIcon } from '@/components/ui/icon';
import type { BodyMeasurementSite, WeightUnit } from '@/lib/prisma-client';
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
import { Section } from '@/components/ui/section';
import { LineChart } from '@/components/progress/line-chart';
import {
  formatLength,
  fromDisplayLength,
  MEASUREMENT_SITES,
  roundLength,
  toDisplayLength,
} from '@/lib/measurement';
import { measurementSiteMessageKeys } from '@/i18n/enum-keys';

// One body measurement, as serialized at the Server Component boundary.
export interface BodyMeasurementView {
  id: string;
  site: BodyMeasurementSite;
  valueCm: number;
  measuredAt: string; // ISO
}

interface Props {
  // All measurements of the trend window, newest first, across every site.
  entries: BodyMeasurementView[];
  unit: WeightUnit;
  // How many recent entries (for the selected site) get a list row.
  listLimit?: number;
  // Body fat estimated from the latest tape measurements (epic 2.4), when the
  // profile and the measurements allow it; `basedOn` is the oldest of them.
  bodyFat?: { percent: number; basedOn: string; usesHips?: boolean } | null;
}

// Native select in the look of the v2 field (48px, radius 12, input hairline).
const SELECT =
  'flex h-12 w-full rounded-md border border-input bg-card px-3.5 text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

// Measurements (issue #202, Corpo tab): the latest value of each site as a
// list (site · date · value), the estimated body fat as the last row with its
// Navy-formula footnote. A site row, or "Registrar", opens a sheet to log a
// value in the display unit (cm in metric, inches in imperial) and see that
// site's trend and recent entries, deletable. Storage is always cm.
export function MeasurementsCard({ entries, unit, listLimit = 5, bodyFat = null }: Props) {
  const t = useTranslations('progress.measurements');
  const siteT = useTranslations('progress.measurements.sites');
  const common = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const metric = unit !== 'LB';
  const unitSuffix = metric ? 'cm' : 'in';
  const shortDate = useCallback(
    (iso: string) => format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit' }),
    [format],
  );

  const [open, setOpen] = useState(false);
  const [site, setSite] = useState<BodyMeasurementSite>('WAIST');
  const [valueField, setValueField] = useState('');
  const [busy, setBusy] = useState(false);
  const siteLabel = useCallback(
    (value: BodyMeasurementSite) => siteT(measurementSiteMessageKeys[value]),
    [siteT],
  );

  // Newest entry per site, in the order of the site list.
  const latestPerSite = useMemo(() => {
    const map = new Map<BodyMeasurementSite, BodyMeasurementView>();
    // entries are newest-first, so the first one seen per site is the latest.
    for (const e of entries) {
      if (!map.has(e.site)) map.set(e.site, e);
    }
    return MEASUREMENT_SITES.filter((s) => map.has(s)).map((s) => map.get(s)!);
  }, [entries]);

  // Entries for the selected site, newest first, and its trend oldest first.
  const siteEntries = useMemo(() => entries.filter((e) => e.site === site), [entries, site]);
  const trend = useMemo(
    () => [...siteEntries].reverse().map((e) => roundLength(toDisplayLength(e.valueCm, metric))),
    [siteEntries, metric],
  );

  function openSheet(value?: BodyMeasurementSite) {
    if (value) setSite(value);
    setOpen(true);
  }

  async function addEntry() {
    const value = parseFloat(valueField);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t('invalid'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, valueCm: fromDisplayLength(value, metric) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('logError'));
        return;
      }
      toast.success(t('logged'));
      setValueField('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/measurements/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('deleteError'));
        return;
      }
      toast.success(t('deleted'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const oldest = siteEntries.at(-1);
  const newest = siteEntries[0];

  return (
    <Section
      size="sm"
      divider
      title={t('title')}
      className="gap-1.5"
      action={
        <Button variant="outline" size="sm" onClick={() => openSheet()}>
          {t('log')}
        </Button>
      }
    >
      {latestPerSite.length === 0 && !bodyFat ? (
        <p className="pt-1 text-caption text-muted-foreground">{t('none')}</p>
      ) : (
        <ul>
          {latestPerSite.map((e) => (
            <li key={e.site} className="border-t border-border first:border-t-0">
              <button
                type="button"
                onClick={() => openSheet(e.site)}
                aria-label={t('openSite', {
                  site: siteLabel(e.site),
                  value: formatLength(e.valueCm, metric),
                  date: shortDate(e.measuredAt),
                })}
                className="flex min-h-11 w-full items-baseline justify-between gap-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="text-[0.9375rem] font-medium">{siteLabel(e.site)}</span>
                <span className="flex items-baseline gap-2.5">
                  <span className="text-[0.8125rem] font-medium text-muted-foreground">
                    {shortDate(e.measuredAt)}
                  </span>
                  <Num stretch={112} className="text-[0.9375rem]">
                    {formatLength(e.valueCm, metric)}
                  </Num>
                </span>
              </button>
            </li>
          ))}
          {bodyFat && (
            <li
              data-testid="body-fat"
              className="flex min-h-11 items-baseline justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
            >
              <span className="text-[0.9375rem] font-medium">{t('bodyFat')}</span>
              <span className="flex items-baseline gap-2.5">
                <span className="text-[0.8125rem] font-medium text-muted-foreground">
                  {shortDate(bodyFat.basedOn)}
                </span>
                <Num stretch={112} className="text-[0.9375rem]">
                  {format.number(bodyFat.percent)}%
                </Num>
              </span>
            </li>
          )}
        </ul>
      )}
      {bodyFat && (
        <p className="pt-1.5 text-small text-muted-foreground text-pretty" data-testid="body-fat-hint">
          {t('bodyFatHint', {
            hips: bodyFat.usesHips ? 'yes' : 'no',
            date: shortDate(bodyFat.basedOn),
          })}
        </p>
      )}

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetTitle>{t('sheetTitle')}</BottomSheetTitle>
          <BottomSheetDescription className="sr-only">
            {t('history', { site: siteLabel(site) })}
          </BottomSheetDescription>
          {/* Site selector + quick add, in the display unit */}
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void addEntry();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="measurement-site">{t('site')}</Label>
                <select
                  id="measurement-site"
                  className={SELECT}
                  value={site}
                  onChange={(e) => setSite(e.target.value as BodyMeasurementSite)}
                >
                  {MEASUREMENT_SITES.map((s) => (
                    <option key={s} value={s}>
                      {siteLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="measurement-value">{t('value', { unit: unitSuffix })}</Label>
                <Input
                  id="measurement-value"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={valueField}
                  onChange={(e) => setValueField(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" variant="ink" loading={busy}>
              {common('actions.save')}
            </Button>
          </form>

          {/* Trend and recent entries of the selected site */}
          <div className="flex flex-col gap-2">
            <h3 className="text-caption font-semibold">{t('history', { site: siteLabel(site) })}</h3>
            {trend.length < 2 ? (
              <p className="text-caption text-muted-foreground">
                {trend.length === 0
                  ? t('empty', { site: siteLabel(site) })
                  : t('second', { site: siteLabel(site) })}
              </p>
            ) : (
              oldest &&
              newest && (
                <LineChart
                  height={110}
                  series={[{ values: trend, tone: 'ink' }]}
                  label={t('chartAria', {
                    site: siteLabel(site),
                    first: formatLength(oldest.valueCm, metric),
                    firstDate: shortDate(oldest.measuredAt),
                    last: formatLength(newest.valueCm, metric),
                    lastDate: shortDate(newest.measuredAt),
                  })}
                  startLabel={shortDate(oldest.measuredAt)}
                  endLabel={shortDate(newest.measuredAt)}
                  formatTick={(v) => format.number(v)}
                />
              )
            )}
            {siteEntries.length > 0 && (
              <ul>
                {siteEntries.slice(0, listLimit).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-t border-border"
                  >
                    <span className="text-[0.8125rem] font-medium text-muted-foreground">
                      {shortDate(e.measuredAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Num stretch={112} className="text-[0.9375rem]">
                        {formatLength(e.valueCm, metric)}
                      </Num>
                      <IconButton
                        type="button"
                        size="sm"
                        aria-label={t('deleteAria', {
                          site: siteLabel(e.site),
                          date: shortDate(e.measuredAt),
                        })}
                        onClick={() => void deleteEntry(e.id)}
                        disabled={busy}
                      >
                        <TrashIcon />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </Section>
  );
}
