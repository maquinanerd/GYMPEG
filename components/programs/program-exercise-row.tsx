'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LinkIcon,
  DotsThreeVerticalIcon,
  PencilSimpleIcon,
  TrashIcon,
  LinkBreakIcon,
} from '@/components/ui/icon';
import type { Exercise, ProgramExercise } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { IconButton } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProgramExerciseFormDialog } from '@/components/programs/program-exercise-form-dialog';
import { ExerciseThumb } from '@/components/exercises/exercise-thumb';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { cn } from '@/lib/utils';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };

interface Props {
  programExercise: ProgramExerciseWithExercise;
  catalog: Exercise[];
  // Position in the workout ("3"), shown when the row is not in a superset.
  position: number;
  // Superset pairing (issue #146, slice 1). The label ("A1") is derived by the
  // parent from group membership and order; the actions are null when not
  // applicable (first row cannot pair up, a standalone row cannot unpair).
  supersetLabel?: string | null;
  onPairWithPrevious?: (() => void) | null;
  onUnpair?: (() => void) | null;
}

// Rest as the sheet reads it: whole minutes as "3 min", anything else in
// seconds ("90 s").
function useRestLabel() {
  const t = useTranslations('programs.detail');
  return (seconds: number) =>
    seconds >= 60 && seconds % 60 === 0
      ? t('restMinutes', { minutes: seconds / 60 })
      : t('restSeconds', { seconds });
}

// One exercise of a program workout: its number (A1/A2 in brand green for a
// superset), the 64px picture, the name, the prescription in numbers and the
// note, with the edit / pair / remove menu at the end.
export function ProgramExerciseRow({
  programExercise,
  catalog,
  position,
  supersetLabel = null,
  onPairWithPrevious = null,
  onUnpair = null,
}: Props) {
  const t = useTranslations('programs.exercise');
  const detailT = useTranslations('programs.detail');
  const common = useTranslations('common');
  const exerciseName = useExerciseName();
  const restLabel = useRestLabel();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t('removeConfirm', { name: exerciseName(programExercise.exercise.name) }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/program-exercises/${programExercise.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(t('removeError'));
        return;
      }
      toast.success(t('removed'));
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const repsLabel =
    programExercise.targetRepsMin === programExercise.targetRepsMax
      ? `${programExercise.targetRepsMin}`
      : `${programExercise.targetRepsMin}‑${programExercise.targetRepsMax}`;

  return (
    <li className="grid grid-cols-[1.75rem_auto_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-border py-3 min-[375px]:grid-cols-[2rem_auto_minmax(0,1fr)_auto]">
      <Num
        stretch={118}
        className={cn('pt-0.5 text-subtitle', supersetLabel && 'text-brand')}
      >
        {supersetLabel ? (
          <>
            <span className="sr-only">{detailT('supersetPrefix')} </span>
            {supersetLabel}
          </>
        ) : (
          position
        )}
      </Num>
      <ExerciseThumb
        name={programExercise.exercise.name}
        muscleGroup={programExercise.exercise.muscleGroup}
        size="md"
      />
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-body font-semibold">
          {exerciseName(programExercise.exercise.name)}
        </span>
        <Num stretch={108} className="text-caption font-medium text-muted-foreground">
          {detailT('prescription', {
            sets: programExercise.targetSets,
            reps: repsLabel,
            rir: programExercise.targetRIR,
            rest: restLabel(programExercise.restSec),
          })}
          {programExercise.tempo && t('tempoValue', { tempo: programExercise.tempo })}
        </Num>
        {programExercise.notes && (
          <span className="line-clamp-3 text-[0.8125rem] font-medium text-muted-foreground">
            {programExercise.notes}
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton size="sm" aria-label={t('actions')} className="-mr-3 -mt-2.5">
            <DotsThreeVerticalIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <PencilSimpleIcon className="mr-2 size-4" />
            {common('actions.edit')}
          </DropdownMenuItem>
          {onPairWithPrevious && (
            <DropdownMenuItem onSelect={() => onPairWithPrevious()}>
              <LinkIcon className="mr-2 size-4" />
              {t('pairPrevious')}
            </DropdownMenuItem>
          )}
          {onUnpair && (
            <DropdownMenuItem onSelect={() => onUnpair()}>
              <LinkBreakIcon className="mr-2 size-4" />
              {t('unpair')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleDelete}
            disabled={deleting}
            className="text-destructive-text focus:text-destructive-text"
          >
            <TrashIcon className="mr-2 size-4" />
            {common('actions.remove')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProgramExerciseFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        programExercise={programExercise}
        catalog={catalog}
      />
    </li>
  );
}
