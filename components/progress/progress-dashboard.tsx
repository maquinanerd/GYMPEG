'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { CaretDownIcon } from '@/components/ui/icon';
import { ChipRow, FilterChip } from '@/components/ui/chip';
import { Num } from '@/components/ui/num';
import { Section } from '@/components/ui/section';
import { Tag } from '@/components/ui/tag';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import type { MuscleGroup, WeightUnit } from '@/lib/prisma-client';
import { STALL_LOOKBACK_SESSIONS, type ExerciseChartPoint } from '@/lib/stats';
import { formatWeight, roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';
import { computeLoadingTable } from '@/lib/loading-table';
import { ExerciseGoalCard, type GoalView } from '@/components/progress/exercise-goal-card';
import { LineChart } from '@/components/progress/line-chart';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { cn } from '@/lib/utils';

// Placeholder the translated sentence is formatted with, then split on, so
// the value inside it can be set as a <Num> while the catalog keeps plain
// ICU arguments.
const SLOT = '\u0000';

function withNum(sentence: string, value: string) {
  const [before, after] = sentence.split(SLOT);
  return (
    <>
      {before}
      <Num stretch={112} className="text-foreground">
        {value}
      </Num>
      {after}
    </>
  );
}

interface RecapRow {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sessions: number;
  firstWeight: number;
  firstDate: string;
  lastWeight: number;
  lastDate: string;
  weightDelta: number;
  firstE1RM: number;
  lastE1RM: number;
  e1rmDelta: number;
  stalled: boolean;
}

interface Props {
  exercises: { id: string; name: string; muscleGroup: string }[];
  selectedExerciseId: string | undefined;
  exercisePoints: ExerciseChartPoint[];
  recap: RecapRow[];
  unit: WeightUnit;
  // Target goal for the selected exercise (issue #90), with the
  // bodyweight-adjusted best e1RM it is measured against.
  selectedGoal: GoalView | null;
  selectedBestE1RM: number;
  selectedUsesBodyweight: boolean;
  // The deload notice (recommended or running), placed after the stalls.
  deload?: React.ReactNode;
}

// Treino tab: pick an exercise, read its estimated 1RM (big number, change
// over the sessions, a line with the record marked), the latest top set, the
// loading table, the goal; then the stalled lifts, the deload notice and the
// 12-week recap of every exercise. Numbers come from lib/ (stats, goals).
export function ProgressDashboard({
  exercises,
  selectedExerciseId,
  exercisePoints,
  recap,
  unit,
  selectedGoal,
  selectedBestE1RM,
  selectedUsesBodyweight,
  deload,
}: Props) {
  const t = useTranslations('progress.dashboard');
  const exerciseT = useTranslations('exercises');
  const format = useFormatter();
  const locale = useLocale();
  const exerciseName = useExerciseName();
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const shortDate = (iso: string | Date) =>
    format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit' });
  const muscleGroupLabel = (group: string) => {
    const key = muscleGroupMessageKeys[group as MuscleGroup];
    return key ? exerciseT(`muscleGroups.${key}`) : group;
  };
  const weight = (kg: number) => formatWeight(kg, unit, { locale });
  const signedWeight = (kg: number) =>
    `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${formatWeight(Math.abs(kg), unit, { locale })}`;
  // Values in the display unit for the chart and the loading table.
  const toDisplay = (kg: number) => (unit === 'KG' ? kg : roundWeight(toDisplayWeight(kg, unit), 1));

  function selectExercise(id: string) {
    if (id === selectedExerciseId) return;
    const params = new URLSearchParams(search?.toString() ?? '');
    params.set('exerciseId', id);
    params.set('tab', 'training');
    startTransition(() => {
      router.push(`/progress?${params.toString()}`, { scroll: false });
    });
  }

  const selectedExo = exercises.find((e) => e.id === selectedExerciseId);

  // Percentage-of-e1RM loading table (issue #226): rows of default percentages
  // of the selected exercise's best e1RM, rounded to a loadable increment in
  // the display unit. The best e1RM is stored in kg, so convert before deriving
  // so the rounding lands on plate jumps in the user's unit. Empty (table
  // hidden) when the exercise has no e1RM yet.
  const loadingRows = useMemo(
    () => computeLoadingTable(toDisplay(selectedBestE1RM), unit),
    // toDisplay is a pure function of `unit`; depend on its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedBestE1RM, unit],
  );

  // Read-only: exercises whose e1RM has plateaued recently.
  const stalledLifts = recap.filter((r) => r.stalled);

  const first = exercisePoints[0];
  const last = exercisePoints[exercisePoints.length - 1];
  const values = exercisePoints.map((p) => toDisplay(p.estimated1RM));
  const best = values.length > 0 ? Math.max(...values) : 0;
  // The record point: the first session that reached the best e1RM.
  const recordIndex = values.indexOf(best);
  const change = first && last ? +(last.estimated1RM - first.estimated1RM).toFixed(1) : 0;

  return (
    <div className="flex flex-col gap-6">
      <ChipRow role="group" aria-label={t('chooseExercise')} aria-busy={isPending || undefined}>
        {exercises.map((e) => (
          <FilterChip
            key={e.id}
            selected={e.id === selectedExerciseId}
            onClick={() => selectExercise(e.id)}
          >
            {exerciseName(e.name)}
          </FilterChip>
        ))}
      </ChipRow>

      <section aria-label={selectedExo ? exerciseName(selectedExo.name) : undefined} className="flex flex-col gap-3">
        {!first || !last ? (
          <p className="py-6 text-caption text-muted-foreground">{t('noExerciseData')}</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[0.8125rem] font-medium text-muted-foreground">
                  {t('oneRm')}
                </span>
                <Num className="text-[2.25rem] leading-none" data-testid="one-rm">
                  {weight(last.estimated1RM)}
                </Num>
              </div>
              {exercisePoints.length > 1 && (
                <span
                  className={cn(
                    'text-right text-caption font-semibold',
                    change > 0 ? 'text-brand' : 'text-muted-foreground',
                  )}
                >
                  {t('delta', { delta: signedWeight(change), count: exercisePoints.length })}
                </span>
              )}
            </div>
            <LineChart
              series={[{ values, tone: 'ink' }]}
              highlightIndex={recordIndex >= 0 ? recordIndex : undefined}
              label={t('chartAria', {
                exercise: selectedExo ? exerciseName(selectedExo.name) : '',
                first: weight(first.estimated1RM),
                firstDate: shortDate(first.sessionStartedAt),
                last: weight(last.estimated1RM),
                lastDate: shortDate(last.sessionStartedAt),
                best: `${format.number(best)} ${unitLabel(unit)}`,
              })}
              startLabel={shortDate(first.sessionStartedAt)}
              endLabel={shortDate(last.sessionStartedAt)}
              formatTick={(v) => format.number(v)}
            />
            <p className="text-caption text-muted-foreground">
              {withNum(
                t('lastTopSet', { value: SLOT, date: shortDate(last.sessionStartedAt) }),
                `${weight(last.maxWeight)} × ${last.topSetReps}`,
              )}
            </p>
          </>
        )}
      </section>

      {/* Training loads (issue #226): percentages of the best e1RM, folded so
          they do not crowd the chart; hidden without an e1RM yet. */}
      {selectedExerciseId && loadingRows.length > 0 && (
        <details className="group border-t border-border pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xs text-subtitle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {t('trainingLoads')}
            <CaretDownIcon
              aria-hidden
              className="size-4 text-subtle transition-transform duration-[120ms] ease-out-quart group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="text-small text-muted-foreground">
            {t('loadingDescription', { value: weight(selectedBestE1RM) })}
          </p>
          <table className="mt-2 w-full text-caption">
            <thead>
              <tr className="text-left text-small text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  {t('oneRmPercent')}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {t('load')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingRows.map((row) => (
                <tr key={row.percent} className="border-t border-border">
                  <td className="py-2">
                    <Num stretch={112}>{row.percent}%</Num>
                  </td>
                  <td className="py-2 text-right">
                    <Num stretch={112}>
                      {format.number(row.weight)} {unitLabel(unit)}
                    </Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* Target goal for the selected exercise */}
      {selectedExerciseId && selectedExo && (
        <ExerciseGoalCard
          exerciseId={selectedExerciseId}
          exerciseName={exerciseName(selectedExo.name)}
          usesBodyweight={selectedUsesBodyweight}
          goal={selectedGoal}
          bestE1RM={selectedBestE1RM}
          unit={unit}
        />
      )}

      {/* Stalled lifts: e1RM flat over the recent sessions (read-only) */}
      {stalledLifts.length > 0 && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-6">
            {stalledLifts.map((r) => (
              <li key={r.exerciseId} className="flex flex-col gap-2 border-t border-border pt-5">
                <Tag variant="warning">{t('stalledBadge')}</Tag>
                <h2 className="text-subtitle">{exerciseName(r.exerciseName)}</h2>
                <p className="text-caption leading-[1.45] text-muted-foreground">
                  {t('stalledLine', {
                    value: weight(r.lastE1RM),
                    count: STALL_LOOKBACK_SESSIONS,
                  })}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-small text-muted-foreground">{t('stalledAdvice')}</p>
        </div>
      )}

      {deload}

      {/* 12-week recap of every exercise */}
      <Section size="sm" divider title={t('recap')}>
        {recap.length === 0 ? (
          <p className="text-caption text-muted-foreground">{t('noRecapData')}</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5 scrollbar-none">
            <table className="w-full text-caption">
              <thead>
                <tr className="text-left text-small text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t('exercise')}
                  </th>
                  <th scope="col" className="whitespace-nowrap py-2 pr-3 text-right font-medium">
                    {t('loadRange')}
                  </th>
                  <th scope="col" className="whitespace-nowrap py-2 text-right font-medium">
                    {t('deltaOneRm')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recap.map((r) => (
                  <tr key={r.exerciseId} className="border-t border-border align-top">
                    <td className="py-2.5 pr-3">
                      <span className="block font-semibold">{exerciseName(r.exerciseName)}</span>
                      <span className="block text-small text-muted-foreground">
                        {t('recapMeta', {
                          group: muscleGroupLabel(r.muscleGroup),
                          count: r.sessions,
                        })}
                      </span>
                      {r.stalled && (
                        <Tag variant="warning" className="mt-1">
                          {t('stalledBadge')}
                        </Tag>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                      <Num stretch={112}>
                        {format.number(toDisplay(r.firstWeight))} →{' '}
                        {format.number(toDisplay(r.lastWeight))} {unitLabel(unit)}
                      </Num>
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap py-2.5 text-right',
                        r.e1rmDelta > 0
                          ? 'text-brand'
                          : r.e1rmDelta < 0
                            ? 'text-destructive-text'
                            : 'text-muted-foreground',
                      )}
                    >
                      <Num stretch={112}>{signedWeight(r.e1rmDelta)}</Num>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
