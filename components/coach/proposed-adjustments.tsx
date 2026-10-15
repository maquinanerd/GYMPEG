'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ProposedChange } from '@/components/ui/coach-text';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
  BottomSheetTrigger,
} from '@/components/ui/bottom-sheet';
import type { Adjustment } from '@/lib/coach-adjustments';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { CoachAdjustments, withProgramDefaults } from './coach-adjustments';
import type { ProgramExerciseDefaults } from './coach-client';

// "3 × 8-12 · 24 kg": the prescription line of a proposed change. Numbers the
// app holds (program values, loads), never AI prose.
function prescription(
  sets: number | null | undefined,
  repsMin: number | null | undefined,
  repsMax: number | null | undefined,
  load: number | null | undefined,
): string {
  const parts: string[] = [];
  if (sets != null && repsMin != null) {
    const reps = repsMax != null && repsMax !== repsMin ? `${repsMin}‑${repsMax}` : `${repsMin}`;
    parts.push(`${sets} × ${reps}`);
  }
  if (load != null) parts.push(`${load} kg`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

// The coach's proposal under a debrief: before (struck through) → after for
// each exercise, and "Revisar ajuste", which opens the existing review where
// the lifter edits, picks and confirms. Nothing is applied from here.
export function ProposedAdjustments({
  debriefId,
  adjustments,
  programDefaults,
  appliedAt,
  onApplied,
}: {
  debriefId: string;
  adjustments: Adjustment[];
  programDefaults: Record<string, ProgramExerciseDefaults>;
  appliedAt: string | null;
  onApplied: (appliedAt: string) => void;
}) {
  const t = useTranslations('coach');
  const exerciseName = useExerciseName();
  const [open, setOpen] = useState(false);
  const count = adjustments.length;

  const lines = adjustments.map((a) => {
    const def = programDefaults[a.exerciseName];
    const next = withProgramDefaults(a, programDefaults);
    return {
      key: a.exerciseName,
      name: exerciseName(a.exerciseName),
      before: prescription(def?.targetSets, def?.targetRepsMin, def?.targetRepsMax, a.currentLoad),
      after: prescription(
        next.suggestedSets,
        next.suggestedRepsMin,
        next.suggestedRepsMax,
        a.suggestedLoad ?? a.currentLoad,
      ),
    };
  });

  const heading = (
    <>
      {t('adjustments.proposed', { count })}
      {appliedAt && ` · ${t('client.applied')}`}
    </>
  );

  const review = (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 self-start border-ink px-4 text-[0.9375rem]"
        >
          {t('adjustments.review', { count })}
        </Button>
      </BottomSheetTrigger>
      <BottomSheetContent>
        <div className="flex flex-col gap-1">
          <BottomSheetTitle>{t('adjustments.title')}</BottomSheetTitle>
          <BottomSheetDescription>{t('adjustments.description')}</BottomSheetDescription>
        </div>
        <CoachAdjustments
          debriefId={debriefId}
          initialAdjustments={adjustments}
          programDefaults={programDefaults}
          alreadyApplied={!!appliedAt}
          onApplied={onApplied}
        />
      </BottomSheetContent>
    </BottomSheet>
  );

  const first = lines[0];
  if (count === 1 && first) {
    return (
      <ProposedChange
        heading={heading}
        title={first.name}
        before={first.before}
        after={first.after}
        note={t('adjustments.note')}
        action={review}
      />
    );
  }

  // Several exercises: the same surface as ProposedChange, one line each, and
  // a single review.
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-card px-4 py-3.5 text-card-foreground">
      <span className="text-[0.8125rem] font-semibold text-muted-foreground">{heading}</span>
      <ul className="flex flex-col gap-2.5">
        {lines.map((line) => (
          <li key={line.key} className="flex flex-col gap-0.5">
            <span className="text-body font-semibold">{line.name}</span>
            <span className="font-num text-caption font-semibold tabular-nums stretch-108">
              <span className="text-muted-foreground line-through">{line.before}</span>
              <span aria-hidden>{'  →  '}</span>
              <span className="sr-only"> → </span>
              {line.after}
            </span>
          </li>
        ))}
      </ul>
      <span className="text-[0.8125rem] font-medium text-muted-foreground">
        {t('adjustments.note')}
      </span>
      {review}
    </div>
  );
}
