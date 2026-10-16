'use client';

import { useTranslations } from 'next-intl';
import type { VolumeLandmarkZone } from '@/lib/stats';
import { Num } from '@/components/ui/num';
import { VolumeTargetEditor } from '@/components/progress/volume-target-editor';
import { cn } from '@/lib/utils';

// One muscle group of the week, as classified on the server (lib/stats).
export interface VolumeRow {
  group: string;
  label: string;
  sets: number;
  // Distinct training days for this muscle in the same week (issue #225).
  frequency: number;
  zone: VolumeLandmarkZone;
  // The band applied to this group: the user's own target or the defaults.
  mev: number;
  mrv: number;
  custom: boolean;
}

// Fill of the bar per zone: the heat scale of the muscle map (heat-1 below
// MEV, heat-2 in the band, heat-3 above MRV), so both read the same.
const ZONE: Record<
  VolumeLandmarkZone,
  { fill: string; text: string; key: 'below' | 'within' | 'above' }
> = {
  BELOW_MEV: { fill: 'bg-heat-1', text: 'text-muted-foreground', key: 'below' },
  WITHIN: { fill: 'bg-heat-2', text: 'text-brand', key: 'within' },
  ABOVE_MRV: { fill: 'bg-heat-3', text: 'text-warning-text', key: 'above' },
};

// "Séries por músculo": per muscle a 12px bar of this week's effective sets on
// a muted track, the MEV-MRV band drawn as a dashed outline over it, then the
// count and its status in words. The whole row opens the band editor.
export function VolumeRows({
  rows,
  defaultBand,
}: {
  rows: VolumeRow[];
  defaultBand: { mev: number; mrv: number };
}) {
  const t = useTranslations('progress.week');
  const dashboard = useTranslations('progress.dashboard');
  // One scale for every row: the biggest of the counts and the band tops.
  const scale = Math.max(10, ...rows.map((r) => Math.max(r.sets, r.mrv))) * 1.1;
  const pct = (value: number) => `${((Math.min(value, scale) / scale) * 100).toFixed(1)}%`;

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const zone = ZONE[row.zone];
        const frequency = dashboard('frequency', { count: row.frequency });
        return (
          <li key={row.group}>
            <VolumeTargetEditor
              muscleGroup={row.group}
              label={row.label}
              mev={row.mev}
              mrv={row.mrv}
              custom={row.custom}
              defaultMev={defaultBand.mev}
              defaultMrv={defaultBand.mrv}
            >
              <button
                type="button"
                aria-label={t('rowLabel', {
                  name: row.label,
                  sets: row.sets,
                  status: t(`status.${zone.key}`),
                  mev: row.mev,
                  mrv: row.mrv,
                  custom: row.custom ? 'yes' : 'no',
                  frequency,
                })}
                className="grid min-h-11 w-full grid-cols-[92px_minmax(0,1fr)_minmax(72px,auto)] items-center gap-2.5 rounded-xs py-1 text-left transition-colors duration-[120ms] ease-out-quart hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <span aria-hidden className="flex min-w-0 flex-col">
                  <span className="text-caption font-semibold leading-tight">{row.label}</span>
                  <span className="text-small text-muted-foreground">{frequency}</span>
                </span>
                <span aria-hidden className="relative h-3 rounded-[2px] bg-muted">
                  <span
                    className="absolute -inset-y-[3px] rounded-[3px] border-[1.5px] border-dashed border-subtle"
                    style={{ left: pct(row.mev), width: pct(row.mrv - row.mev) }}
                  />
                  {row.sets > 0 && (
                    <span
                      data-zone={row.zone}
                      className={cn('absolute inset-y-0 left-0 rounded-[2px]', zone.fill)}
                      style={{ width: pct(row.sets) }}
                    />
                  )}
                </span>
                <span aria-hidden className="flex flex-col items-end leading-[1.15]">
                  <Num stretch={112} className="text-caption">
                    {t('setsValue', { sets: row.sets })}
                  </Num>
                  <span className={cn('text-small font-semibold', zone.text)}>
                    {t(`status.${zone.key}`)}
                  </span>
                </span>
              </button>
            </VolumeTargetEditor>
          </li>
        );
      })}
    </ul>
  );
}
