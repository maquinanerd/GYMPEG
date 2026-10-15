'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MagnifyingGlassIcon, PlusIcon } from '@/components/ui/icon';
import type { Exercise, MuscleGroup } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { ChipRow, FilterChip } from '@/components/ui/chip';
import { ListRow } from '@/components/ui/list-row';
import { textLinkClass } from '@/components/ui/section';
import { ExerciseFormDialog } from '@/components/exercises/exercise-form-dialog';
import { ExerciseThumb } from '@/components/exercises/exercise-thumb';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { equipmentTypeMessageKeys, muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { matchesExerciseQuery } from '@/lib/catalog/search-index';
import { exerciseFitsEquipment } from '@/lib/ai/workout-plan';

// The muscle chips of the catalog: each one gathers the groups a lifter
// thinks of under that word. Abs and unclassified exercises only show under
// "Todos".
const MUSCLE_CHIPS = {
  chest: ['CHEST'],
  back: ['BACK_WIDTH', 'BACK_THICKNESS', 'LOWER_BACK'],
  legs: ['QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES'],
  shoulders: ['SHOULDERS_FRONT', 'SHOULDERS_LATERAL', 'SHOULDERS_REAR'],
  arms: ['BICEPS', 'TRICEPS', 'FOREARMS'],
} as const satisfies Record<string, readonly MuscleGroup[]>;

type ChipKey = 'all' | keyof typeof MUSCLE_CHIPS | 'available';

interface ExercisesViewProps {
  exercises: Exercise[];
  // Equipment of the lifter's active gym; "Só o que tenho" shows only when the
  // gym lists some (an empty list rules nothing out).
  availableEquipment?: string[] | null;
}

export function ExercisesView({ exercises, availableEquipment = null }: ExercisesViewProps) {
  const t = useTranslations('exercises');
  const locale = useLocale();
  const exerciseName = useExerciseName();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipKey>('all');

  const canFilterByGym = availableEquipment != null && availableEquipment.length > 0;
  const chips: ChipKey[] = [
    'all',
    ...(Object.keys(MUSCLE_CHIPS) as (keyof typeof MUSCLE_CHIPS)[]),
    ...(canFilterByGym ? (['available'] as const) : []),
  ];

  // Alphabetical by the name the lifter reads.
  const sorted = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: 'base' });
    return [...exercises].sort((a, b) => collator.compare(exerciseName(a.name), exerciseName(b.name)));
  }, [exerciseName, exercises, locale]);

  // Accent- and case-insensitive match on the name, the displayed (pt-BR)
  // name and the catalog search terms ("puxada", "pulley"), then the chip.
  // Both only narrow the already-loaded list (no API call).
  const filtered = useMemo(() => {
    const trimmed = query.trim();
    return sorted.filter((ex) => {
      if (trimmed && !matchesExerciseQuery(ex.name, exerciseName(ex.name), trimmed)) return false;
      if (chip === 'all') return true;
      if (chip === 'available') {
        return exerciseFitsEquipment(ex.equipmentTags ?? [], availableEquipment ?? []);
      }
      return (MUSCLE_CHIPS[chip] as readonly MuscleGroup[]).includes(ex.muscleGroup);
    });
  }, [availableEquipment, chip, exerciseName, query, sorted]);

  const createDialog = (
    <ExerciseFormDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
  );

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 px-5 py-6">
        <div className="flex flex-col gap-1">
          <p className="text-subtitle">{t('emptyTitle')}</p>
          <p className="max-w-prose text-caption text-muted-foreground">{t('emptyDescription')}</p>
        </div>
        <Button variant="ink" size="sm" className="mt-1" onClick={() => setCreateOpen(true)}>
          <PlusIcon weight="bold" />
          {t('list.create')}
        </Button>
        {createDialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 px-5 pt-4">
        <label className="flex h-12 items-center gap-2.5 rounded-md border border-input bg-card px-3.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
          <MagnifyingGlassIcon weight="bold" className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('list.searchPlaceholder')}
            aria-label={t('search')}
            className="h-full min-w-0 flex-1 bg-transparent text-body font-medium placeholder:text-muted-foreground focus:outline-none"
          />
        </label>

        <ChipRow role="group" aria-label={t('list.filters')}>
          {chips.map((key) => (
            <FilterChip key={key} selected={chip === key} onClick={() => setChip(key)}>
              {t(`list.chips.${key}`)}
            </FilterChip>
          ))}
        </ChipRow>

        <div className="flex min-h-touch items-center justify-between gap-3">
          <p className="text-[0.8125rem] font-medium text-muted-foreground" aria-live="polite">
            {chip === 'all'
              ? t('list.count', { count: filtered.length })
              : t('list.countFiltered', {
                  count: filtered.length,
                  filter: t(`list.chips.${chip}`),
                })}
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className={`${textLinkClass} -mr-2 flex min-h-touch items-center gap-1 px-2`}
          >
            <PlusIcon weight="bold" className="size-3.5" />
            {t('list.create')}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-5 py-6">
          {query.trim() ? (
            <div className="flex flex-col gap-1">
              <p className="text-subtitle">{t('noMatchTitle')}</p>
              <p className="max-w-prose text-caption text-muted-foreground">
                {t('noMatchDescription', { query: query.trim() })}
              </p>
            </div>
          ) : (
            <p className="text-subtitle">{t('list.noFilterMatch')}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery('');
              setChip('all');
            }}
          >
            {t('list.showAll')}
          </Button>
        </div>
      ) : (
        <ul className="px-5 pb-7 pt-1.5">
          {filtered.map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} />
          ))}
        </ul>
      )}

      {createDialog}
    </div>
  );
}

function ExerciseRow({ exercise }: { exercise: Exercise }) {
  const t = useTranslations('exercises');
  const exerciseName = useExerciseName();
  const displayName = exerciseName(exercise.name);

  // 68px row: the 52px picture, the name (up to two lines, never truncated
  // first) and "muscle · equipment" in the compact equipment form (#330).
  return (
    <ListRow
      href={`/exercises/${exercise.id}`}
      leading={<ExerciseThumb name={exercise.name} muscleGroup={exercise.muscleGroup} />}
      title={<span className="line-clamp-2">{displayName}</span>}
      meta={
        <span data-testid="exercise-meta">
          {t(`muscleGroups.${muscleGroupMessageKeys[exercise.muscleGroup]}`)}
          {' · '}
          {t(`equipmentTypesShort.${equipmentTypeMessageKeys[exercise.equipmentType]}`)}
        </span>
      }
      chevron
      contentClassName="min-h-[4.25rem] py-2.5"
    />
  );
}
