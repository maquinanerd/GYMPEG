'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Filter, X } from 'lucide-react';
import type { MuscleGroup } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTrainingName } from '@/components/shared/use-training-name';
import { buildHistoryCsvHref } from '@/lib/history-calendar';
import {
  hasHistoryFilters,
  setHistoryFilterParams,
  type HistoryFilterValues,
} from '@/lib/history-filters';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';

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

  function apply(next: HistoryFilterValues) {
    const params = setHistoryFilterParams(new URLSearchParams(search.toString()), next);
    params.set('month', selectedMonth);
    params.delete('day');
    startTransition(() => router.push(`/history?${params.toString()}`));
  }

  function select<K extends keyof HistoryFilterValues>(key: K, value: string) {
    apply({ ...filters, [key]: value === ALL ? undefined : value });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="size-4" />
        <span>{t('title')}</span>
        <Button variant="outline" size="sm" asChild className="ml-auto" title={t('csvTitle')}>
          <a href={buildHistoryCsvHref(filters)} download>
            <Download className="size-4" />
            <span className="ml-1">CSV</span>
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          value={filters.programId ?? ALL}
          onValueChange={(value) => select('programId', value)}
        >
          <SelectTrigger className="h-9" disabled={isPending} aria-label={t('program')}>
            <SelectValue />
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
            className="h-9"
            disabled={isPending || gyms.length === 0}
            aria-label={t('gym')}
          >
            <SelectValue />
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
            className="h-9"
            disabled={isPending || exercises.length === 0}
            aria-label={t('exercise')}
          >
            <SelectValue />
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
            className="h-9"
            disabled={isPending || muscles.length === 0}
            aria-label={t('muscle')}
          >
            <SelectValue />
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
      </div>

      {hasHistoryFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => apply({})}
          disabled={isPending}
        >
          <X className="size-4" />
          <span className="ml-1">{t('clear')}</span>
        </Button>
      )}
    </div>
  );
}
