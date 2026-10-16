'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { CheckIcon } from '@/components/ui/icon';
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

// The exercises of the workout as underlined tabs on a hairline: the number
// (or the A1/A2 superset label) in the widened number style, then the name.
// The current one is 600 with a 2px ink underline; tapping it again opens the
// exercise details. A finished exercise carries a check.
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
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    currentRef.current?.scrollIntoView?.({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentIndex]);

  return (
    <nav
      aria-label={t('exerciseStripLabel')}
      className="flex gap-5 overflow-x-auto border-b border-border px-5 scrollbar-none"
    >
      {exercises.map((programExercise, index) => {
        const displayName = exerciseName(programExercise.exercise.name);
        const isCurrent = index === currentIndex;
        const isComplete = completedProgramExerciseIds.has(programExercise.id);
        const supersetLabel = supersetLabels?.get(programExercise.id);

        return (
          <button
            key={programExercise.id}
            ref={isCurrent ? currentRef : undefined}
            type="button"
            onClick={() => {
              if (disabled) return;
              if (isCurrent) onOpen(index);
              else onSelect(index);
            }}
            aria-disabled={disabled}
            aria-label={`${index + 1}. ${displayName}${isComplete ? ` · ${t('exerciseCompleted')}` : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            title={displayName}
            data-superset-group={programExercise.supersetGroup ?? undefined}
            className={cn(
              '-mb-px flex h-12 max-w-[14rem] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-caption transition-colors duration-[120ms] ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none',
              isCurrent
                ? 'border-ink font-semibold text-foreground'
                : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed',
            )}
          >
            <span className="font-num text-[0.8125rem] font-semibold tabular-nums stretch-112">
              {supersetLabel ?? index + 1}
            </span>
            <span className="truncate">{displayName}</span>
            {isComplete && <CheckIcon className="size-3.5 shrink-0 text-brand" />}
          </button>
        );
      })}
    </nav>
  );
}
