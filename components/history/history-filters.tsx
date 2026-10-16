'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DownloadSimpleIcon, SlidersHorizontalIcon, XIcon } from '@/components/ui/icon';
import type { MuscleGroup } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { ChipRow, FilterChip } from '@/components/ui/chip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrainingName } from '@/components/shared/use-training-name';
import { buildHistoryCsvHref } from '@/lib/history-calendar';
import {
  hasHistoryFilters,
  setHistoryFilterParams,
  type HistoryFilterValues,
} from '@/lib/history-filters';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  name: string;
}

interface Props {
  programs: Option[];
  gyms: Option[];
  // Exercises and muscles that appear in the finished history.
  exercises: Option[];
  muscles: MuscleGroup[];
  filters: HistoryFilterValues;
  selectedMonth: string;
}

const ALL = 'all';

// A select drawn as a 40px filter chip: the filter's name while unset, the
// chosen value in ink once set.
const CHIP_TRIGGER =
  'h-10 w-auto shrink-0 gap-1.5 rounded-sm px-3.5 text-caption font-semibold transition-colors duration-[120ms] ease-out-quart [&>span]:line-clamp-1 [&>span]:max-w-[11rem]';
const CHIP_IDLE = 'border-input bg-transparent text-foreground hover:bg-muted';
const CHIP_SET = 'border-ink bg-ink text-ink-foreground [&_svg]:text-ink-foreground';

export function HistoryFilters({
  programs,
  gyms,
  exercises,
  muscles,
  filters,
  selectedMonth,
}: Props) {
  const t = useTranslations('history.filters');
  const exercisesT = useTranslations('exercises');
  const trainingName = useTrainingName();
  const router = useRouter();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(true);
  const groupId = useId();

  function apply(next: HistoryFilterValues) {
    const params = setHistoryFilterParams(new URLSearchParams(search.toString()), next);
    params.set('month', selectedMonth);
    params.delete('day');
    startTransition(() => router.push(`/history?${params.toString()}`));
  }

  function select<K extends keyof HistoryFilterValues>(key: K, value: string) {
    apply({ ...filters, [key]: value === ALL ? undefined : value });
  }

  const active = hasHistoryFilters(filters);

  return (
    <ChipRow aria-busy={isPending || undefined}>
      {/* "Filtros" shows or hides the filter chips; open by default. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={groupId}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          'inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 text-caption font-semibold transition-colors duration-[120ms] ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4',
          expanded || active ? CHIP_SET : CHIP_IDLE,
        )}
      >
        <SlidersHorizontalIcon weight="bold" />
        {t('toggle')}
      </button>

      <div
        id={groupId}
        role="group"
        aria-label={t('toggle')}
        hidden={!expanded}
        className={cn('flex shrink-0 gap-2', !expanded && 'hidden')}
      >
        <Select
          value={filters.programId ?? ALL}
          onValueChange={(value) => select('programId', value)}
        >
          <SelectTrigger
            disabled={isPending}
            aria-label={t('program')}
            className={cn(CHIP_TRIGGER, filters.programId ? CHIP_SET : CHIP_IDLE)}
          >
            {filters.programId ? <SelectValue /> : <SelectValue>{t('program')}</SelectValue>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allPrograms')}</SelectItem>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {trainingName(program.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.gymId ?? ALL} onValueChange={(value) => select('gymId', value)}>
          <SelectTrigger
            disabled={isPending || gyms.length === 0}
            aria-label={t('gym')}
            className={cn(CHIP_TRIGGER, filters.gymId ? CHIP_SET : CHIP_IDLE)}
          >
            {filters.gymId ? <SelectValue /> : <SelectValue>{t('gym')}</SelectValue>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allGyms')}</SelectItem>
            {gyms.map((gym) => (
              <SelectItem key={gym.id} value={gym.id}>
                {gym.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.exerciseId ?? ALL}
          onValueChange={(value) => select('exerciseId', value)}
        >
          <SelectTrigger
            disabled={isPending || exercises.length === 0}
            aria-label={t('exercise')}
            className={cn(CHIP_TRIGGER, filters.exerciseId ? CHIP_SET : CHIP_IDLE)}
          >
            {filters.exerciseId ? <SelectValue /> : <SelectValue>{t('exercise')}</SelectValue>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allExercises')}</SelectItem>
            {exercises.map((exercise) => (
              <SelectItem key={exercise.id} value={exercise.id}>
                {exercise.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.muscle ?? ALL} onValueChange={(value) => select('muscle', value)}>
          <SelectTrigger
            disabled={isPending || muscles.length === 0}
            aria-label={t('muscle')}
            className={cn(CHIP_TRIGGER, filters.muscle ? CHIP_SET : CHIP_IDLE)}
          >
            {filters.muscle ? <SelectValue /> : <SelectValue>{t('muscle')}</SelectValue>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allMuscles')}</SelectItem>
            {muscles.map((muscle) => (
              <SelectItem key={muscle} value={muscle}>
                {exercisesT(`muscleGroups.${muscleGroupMessageKeys[muscle]}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {active && (
          <FilterChip onClick={() => apply({})} disabled={isPending} aria-pressed={undefined}>
            <XIcon weight="bold" />
            {t('clear')}
          </FilterChip>
        )}
      </div>
    </ChipRow>
  );
}

// The header's CSV export: every finished set, narrowed by the active
// filters (the month on screen is a view, not an export scope).
export function HistoryCsvLink({ filters }: { filters: HistoryFilterValues }) {
  const t = useTranslations('history.filters');
  return (
    <Button variant="outline" size="sm" asChild title={t('csvTitle')}>
      <a href={buildHistoryCsvHref(filters)} download>
        <DownloadSimpleIcon weight="bold" />
        CSV
      </a>
    </Button>
  );
}
