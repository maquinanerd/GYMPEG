import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { WeightUnit } from '@/lib/prisma-client';
import type { ConsistencyWeek } from '@/lib/stats';
import type { MuscleMapRegion } from '@/lib/muscle-map';
import type { WeeklyReport } from '@/lib/training-engine/weekly-report';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { formatWeight, roundWeight, toDisplayWeight } from '@/lib/units';
import { EmptyState } from '@/components/ui/empty-state';
import { Num } from '@/components/ui/num';
import { Section, textLinkClass } from '@/components/ui/section';
import { ConditioningCard, type ConditioningWeekView } from '@/components/progress/conditioning-card';
import { ConsistencyCard } from '@/components/progress/consistency-card';
import { MuscleMapCard } from '@/components/progress/muscle-map-card';
import { VolumeRows, type VolumeRow } from '@/components/progress/volume-rows';
import { WeekBars } from '@/components/progress/week-bars';

export interface WeekSummaryView {
  // First and last calendar day of the rolling 7 days (ISO).
  startIso: string;
  endIso: string;
  workouts: number;
  minutes: number;
  sets: number;
}

export interface WeekPanelProps {
  // At least one strength set in the 12-week window.
  hasData: boolean;
  emptyWeeks: number;
  summary: WeekSummaryView;
  // The week the sets-per-muscle rows describe (last completed one).
  muscles: { weekKey: string; weekStartIso: string; rows: VolumeRow[] } | null;
  defaultBand: { mev: number; mrv: number };
  muscleMap: MuscleMapRegion[];
  report: { report: WeeklyReport; weekStartIso: string };
  consistency: { weeks: ConsistencyWeek[]; currentStreak: number; weeklyFrequency: number | null };
  // Weekly tonnage in kg, oldest first.
  volumeWeeks: { weekStartIso: string; totalKg: number }[];
  conditioning: ConditioningWeekView[] | null;
  unit: WeightUnit;
  timeZone: string;
}

const DAY_MS = 86_400_000;

// Semana tab: the last 7 days in three numbers, sets per muscle against the
// MEV-MRV band, the week map, the computed week report and the recent weekly
// trends (consistency, volume, cardio). Every number comes from lib/.
export function WeekPanel(props: WeekPanelProps) {
  const t = useTranslations('progress.week');
  const root = useTranslations('progress');
  const format = useFormatter();
  const { timeZone, unit } = props;
  const range = (start: Date, end: Date) =>
    format.dateTimeRange(start, end, { day: '2-digit', month: 'short', timeZone });
  const weekRange = (startIso: string) => {
    const start = new Date(startIso);
    return range(start, new Date(start.getTime() + 6 * DAY_MS));
  };

  const trends = (
    <Section size="sm" divider title={t('trends')}>
      <div className="flex flex-col gap-6">
        {props.hasData && <ConsistencyCard {...props.consistency} />}
        {props.hasData && props.volumeWeeks.length > 0 && (
          <VolumeTrend weeks={props.volumeWeeks} unit={unit} />
        )}
        {props.conditioning && <ConditioningCard weeks={props.conditioning} />}
      </div>
    </Section>
  );

  if (!props.hasData) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          title={root('emptyTitle')}
          description={root('emptyDescription', { weeks: props.emptyWeeks })}
          action={{ label: root('firstSession'), href: '/session/new' }}
        />
        {props.conditioning && trends}
      </div>
    );
  }

  const { summary } = props;
  const hours = Math.floor(summary.minutes / 60);
  const minutes = summary.minutes % 60;
  const duration =
    hours > 0
      ? t('hoursMinutes', { hours, minutes: String(minutes).padStart(2, '0') })
      : t('minutesOnly', { minutes });

  return (
    <div className="flex flex-col gap-[26px]">
      <div className="flex flex-col gap-3">
        <p className="text-caption text-muted-foreground">
          {t('last7', { range: range(new Date(summary.startIso), new Date(summary.endIso)) })}
        </p>
        <dl className="grid grid-cols-3 gap-3">
          {(
            [
              ['workouts', format.number(summary.workouts)],
              ['time', duration],
              ['sets', format.number(summary.sets)],
            ] as const
          ).map(([key, value]) => (
            <div key={key}>
              <dt className="text-[0.8125rem] font-medium text-muted-foreground">{t(key)}</dt>
              <dd className="mt-0.5">
                <Num stretch={118} className="text-[1.625rem] leading-tight">
                  {value}
                </Num>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <Section title={t('muscles')} aside={t('bandHint')} className="gap-1" headerClassName="pb-1.5">
        {props.muscles && props.muscles.rows.length > 0 ? (
          <>
            <p className="text-small text-muted-foreground">
              {t('weekOf', { range: weekRange(props.muscles.weekStartIso) })}
            </p>
            <VolumeRows rows={props.muscles.rows} defaultBand={props.defaultBand} />
            <p className="pt-2 text-small text-muted-foreground text-pretty">
              {t('musclesNote', { mev: props.defaultBand.mev, mrv: props.defaultBand.mrv })}
            </p>
          </>
        ) : (
          <p className="text-caption text-muted-foreground">{t('noMuscles')}</p>
        )}
      </Section>

      {props.muscles && props.muscleMap.length > 0 && (
        <MuscleMapCard
          regions={props.muscleMap}
          weekLabel={t('weekOf', { range: weekRange(props.muscles.weekStartIso) })}
        />
      )}

      <WeekReportSummary
        report={props.report.report}
        range={weekRange(props.report.weekStartIso)}
        muscles={
          props.muscles?.weekKey === props.report.report.weekKey ? props.muscles.rows : []
        }
        unit={unit}
      />

      {trends}
    </div>
  );
}

// "Relatório da semana": the deterministic weekly report (lib/training-engine
// /weekly-report) put into sentences. No AI text: the coach has no stored
// comment on a week yet, so there is no coach line here.
function WeekReportSummary({
  report,
  range,
  muscles,
  unit,
}: {
  report: WeeklyReport;
  range: string;
  // Rows of the same week, for the above/below sentences.
  muscles: VolumeRow[];
  unit: WeightUnit;
}) {
  const t = useTranslations('progress.week');
  const format = useFormatter();
  const locale = useLocale();
  const weight = (kg: number, decimals = 1) => formatWeight(kg, unit, { locale, decimals });
  const names = (zone: VolumeRow['zone']) =>
    format.list(
      muscles.filter((m) => m.zone === zone).map((m) => m.label),
      { type: 'conjunction' },
    );
  const above = muscles.some((m) => m.zone === 'ABOVE_MRV');
  const below = muscles.some((m) => m.zone === 'BELOW_MEV');

  const sentences =
    report.workingSets === 0
      ? [t('reportEmpty')]
      : [
          report.sessions.planned != null
            ? t('reportSessions', {
                done: report.sessions.done,
                planned: report.sessions.planned,
              })
            : t('reportSessionsDone', { done: report.sessions.done }),
          t('reportVolume', {
            effective: format.number(report.effectiveSets),
            working: format.number(report.workingSets),
            weight: weight(report.tonnageKg, 0),
          }),
          report.records > 0 ? t('reportRecords', { count: report.records }) : null,
          above ? t('reportAbove', { names: names('ABOVE_MRV') }) : null,
          below ? t('reportBelow', { names: names('BELOW_MEV') }) : null,
          report.bestProgress
            ? t('reportBest', {
                exercise: getExerciseDisplayName(report.bestProgress.exerciseName, locale),
                from: weight(report.bestProgress.fromKg),
                to: weight(report.bestProgress.toKg),
              })
            : null,
        ].filter((s): s is string => s != null);

  return (
    <Section
      size="sm"
      divider
      title={t('report')}
      action={
        <Link href="/progress/report" className={textLinkClass}>
          {t('reportLink')}
        </Link>
      }
    >
      <p className="-mt-1 text-small text-muted-foreground">{range}</p>
      <p className="text-[0.9375rem] font-medium leading-[1.5] text-pretty" data-testid="week-report">
        {sentences.join(' ')}
      </p>
    </Section>
  );
}

// Weekly tonnage over the window as ink bars, in the display unit.
function VolumeTrend({
  weeks,
  unit,
}: {
  weeks: { weekStartIso: string; totalKg: number }[];
  unit: WeightUnit;
}) {
  const t = useTranslations('progress.week');
  const format = useFormatter();
  const locale = useLocale();
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const first = weeks[0]!;
  const last = weeks[weeks.length - 1]!;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-caption font-semibold">{t('volume')}</h3>
        <Num stretch={112} className="text-caption">
          {formatWeight(last.totalKg, unit, { locale, decimals: 0 })}
        </Num>
      </div>
      <WeekBars
        values={weeks.map((w) => roundWeight(toDisplayWeight(w.totalKg, unit), 0))}
        label={t('volumeAria', {
          count: weeks.length,
          first: formatWeight(first.totalKg, unit, { locale, decimals: 0 }),
          last: formatWeight(last.totalKg, unit, { locale, decimals: 0 }),
        })}
        startLabel={day(first.weekStartIso)}
        endLabel={day(last.weekStartIso)}
      />
      <p className="text-small text-muted-foreground">{t('volumeNote')}</p>
    </div>
  );
}
