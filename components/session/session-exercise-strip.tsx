'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { CheckIcon } from '@/components/ui/icon';
import { Chip } from '@/components/ui/chip';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { cn } from '@/lib/utils';

type SessionExercise = ProgramExercise & { exercise: Exercise };

interface Props {
  exercises: SessionExercise[];
  currentIndex: number;
  completedProgramExerciseIds: ReadonlySet<string>;
  // Superset labels (A1, A2...) by program row, from lib/supersets.
  supersetLabels?: ReadonlyMap<string, string>;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  // While the runner is not in input mode (rest, summary) the strip is inert:
  // neither switching nor opening details, because opening navigates away and
  // a remount loses the rest timer and its pending auto-advance.
  disabled?: boolean;
}

// Horizontal strip of 48px chips, one per exercise of the workout: its number
// (or its A1/A2 superset label) and name. The current exercise is the lime
// chip; tapping it again opens the exercise details. A finished exercise
// carries a check.
export function SessionExerciseStrip({
  exercises,
  currentIndex,
  completedProgramExerciseIds,
  supersetLabels,
  onSelect,
  onOpen,
  disabled = false,
}: Props) {
  const exerciseName = useExerciseName();
  const t = useTranslations('session');
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentIndex]);

  return (
    <div
      className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={t('exerciseStripLabel')}
    >
      <div className="flex w-max gap-2">
        {exercises.map((programExercise, index) => {
          const displayName = exerciseName(programExercise.exercise.name);
          const isCurrent = index === currentIndex;
          const isComplete = completedProgramExerciseIds.has(programExercise.id);
          const supersetLabel = supersetLabels?.get(programExercise.id);

          return (
            <Chip
              key={programExercise.id}
              ref={isCurrent ? currentRef : undefined}
              selected={isCurrent}
              onClick={() => {
                if (disabled) return;
                if (isCurrent) onOpen(index);
                else onSelect(index);
              }}
              aria-pressed={undefined}
              aria-disabled={disabled}
              aria-label={`${index + 1}. ${displayName}${isComplete ? ` · ${t('exerciseCompleted')}` : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              title={displayName}
              data-superset-group={programExercise.supersetGroup ?? undefined}
              className={cn('max-w-[14rem]', disabled && 'cursor-not-allowed')}
            >
              <span className="tabular-nums">{supersetLabel ?? index + 1}</span>
              <span className="truncate font-medium">{displayName}</span>
              {isComplete && (
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full',
                    isCurrent ? 'bg-primary-foreground text-primary' : 'bg-brand text-card',
                  )}
                >
                  <CheckIcon className="size-3" />
                </span>
              )}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
