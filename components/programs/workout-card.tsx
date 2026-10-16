'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  DotsThreeIcon,
  PlusIcon,
  PencilSimpleIcon,
  PrinterIcon,
  TrashIcon,
} from '@/components/ui/icon';
import type { Exercise, ProgramExercise, Workout } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { Button, IconButton } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MuscleMap } from '@/components/progress/muscle-map';
import { ProgramExerciseRow } from '@/components/programs/program-exercise-row';
import { ProgramExerciseFormDialog } from '@/components/programs/program-exercise-form-dialog';
import { buildSupersetView, smallestFreeGroup } from '@/lib/supersets';
import { compactMuscles } from '@/lib/muscle-map';
import { estimateWorkoutMinutes } from '@/lib/home-week';
import { useTrainingName } from '@/components/shared/use-training-name';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };
export type WorkoutWithExercises = Workout & { exercises: ProgramExerciseWithExercise[] };

interface Props {
  workout: WorkoutWithExercises;
  catalog: Exercise[];
  // Opens the workout's edit dialog (owned by the page, which also opens it
  // from the header's "Editar").
  onEdit: () => void;
}

// "Treino A — Superiores" reads on two lines: the letter, then the focus.
function splitTitle(name: string): [string, string | null] {
  const match = /^(.+?)\s+[—–-]\s+(.+)$/.exec(name);
  return match ? [match[1]!, match[2]!] : [name, null];
}

// One workout of a program as a sheet (design v2 "Treino do programa"): the
// 32px title on two lines, its meta line and muscle figure, then the
// numbered exercises (A1/A2 for a superset) with their prescriptions.
export function ProgramWorkout({ workout, catalog, onEdit }: Props) {
  const t = useTranslations('programs.workout');
  const programsT = useTranslations('programs');
  const exerciseT = useTranslations('programs.exercise');
  const common = useTranslations('common');
  const format = useFormatter();
  const trainingName = useTrainingName();
  const router = useRouter();
  const [addExoOpen, setAddExoOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(t('deleteConfirm', { name: trainingName(workout.name) }))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(t('deleteError'));
        return;
      }
      toast.success(t('deleted'));
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  // Superset pairing (issue #146, slice 1): rows render in presentation order
  // (group members together) with A1/A2 labels derived on read.
  const supersetView = buildSupersetView(workout.exercises);

  async function updateSupersetGroup(
    pe: ProgramExerciseWithExercise,
    supersetGroup: number | null,
  ): Promise<boolean> {
    const res = await fetch(`/api/program-exercises/${pe.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exerciseId: pe.exerciseId,
        targetSets: pe.targetSets,
        targetRepsMin: pe.targetRepsMin,
        targetRepsMax: pe.targetRepsMax,
        targetRIR: pe.targetRIR,
        restSec: pe.restSec,
        tempo: pe.tempo,
        notes: pe.notes,
        supersetGroup,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? t('supersetUpdateError'));
      return false;
    }
    return true;
  }

  // Pairs a row with the one above it (in presentation order): joins the
  // previous row's group, creating a fresh group for both when the previous
  // row is standalone.
  async function handlePairWithPrevious(index: number) {
    const pe = supersetView.ordered[index];
    const previous = supersetView.ordered[index - 1];
    if (!pe || !previous) return;
    let group = previous.supersetGroup;
    if (group == null) {
      group = smallestFreeGroup(workout.exercises);
      if (group == null) {
        toast.error(t('supersetLimit'));
        return;
      }
      if (!(await updateSupersetGroup(previous, group))) return;
    }
    if (!(await updateSupersetGroup(pe, group))) return;
    toast.success(t('supersetPaired'));
    router.refresh();
  }

  async function handleUnpair(pe: ProgramExerciseWithExercise) {
    if (!(await updateSupersetGroup(pe, null))) return;
    toast.success(t('supersetRemoved'));
    router.refresh();
  }

  const [titleTop, titleBottom] = splitTitle(trainingName(workout.name));
  const sets = workout.exercises.reduce((sum, row) => sum + row.targetSets, 0);
  const minutes = estimateWorkoutMinutes(workout.exercises);
  // ISO weekday n is January n of 2024 (a Monday): the long weekday name.
  const day =
    workout.dayOfWeek != null
      ? format.dateTime(new Date(Date.UTC(2024, 0, workout.dayOfWeek, 12)), {
          weekday: 'long',
          timeZone: 'UTC',
        })
      : null;
  const meta = [
    day,
    common('counts.exercises', { count: workout.exercises.length }),
    workout.exercises.length > 0 ? common('counts.sets', { count: sets }) : null,
    minutes != null ? programsT('detail.minutes', { minutes }) : null,
  ].filter(Boolean);

  // Standalone rows count 1, 2, 3...; superset members read A1, A2.
  let standalone = 0;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-balance text-[2rem] font-semibold leading-[1.02] tracking-[-0.025em]">
            <span className="block">{titleTop}</span>
            {titleBottom && <span className="block">{titleBottom}</span>}
          </h1>
          <p className="text-caption text-muted-foreground first-letter:uppercase">
            {meta.join(' · ')}
          </p>
        </div>
        {workout.exercises.length > 0 && (
          <MuscleMap
            active={compactMuscles(workout.exercises.map((row) => row.exercise.muscleGroup))}
            size={104}
            className="max-[359px]:h-auto max-[359px]:w-20"
          />
        )}
      </div>

      {workout.exercises.length === 0 ? (
        <p className="border-y border-border py-3.5 text-caption text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ol className="flex flex-col">
          {supersetView.ordered.map((pe, index) => {
            const previous = supersetView.ordered[index - 1];
            const alreadyPairedWithPrevious =
              pe.supersetGroup != null &&
              previous != null &&
              previous.supersetGroup === pe.supersetGroup;
            const label = supersetView.labels.get(pe.id) ?? null;
            if (!label) standalone += 1;
            return (
              <ProgramExerciseRow
                key={pe.id}
                programExercise={pe}
                catalog={catalog}
                position={standalone}
                supersetLabel={label}
                onPairWithPrevious={
                  index > 0 && !alreadyPairedWithPrevious
                    ? () => handlePairWithPrevious(index)
                    : null
                }
                onUnpair={pe.supersetGroup != null ? () => handleUnpair(pe) : null}
              />
            );
          })}
        </ol>
      )}

      <div className="-mt-1 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddExoOpen(true)}
            disabled={catalog.length === 0}
          >
            <PlusIcon weight="bold" />
            {exerciseT('add')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton size="sm" tone="outline" aria-label={t('actions')} className="size-10 rounded-sm">
                <DotsThreeIcon className="!size-5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={onEdit}>
                <PencilSimpleIcon className="mr-2 size-4" />
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  router.push(`/programs/${workout.programId}/print?workout=${workout.id}`)
                }
              >
                <PrinterIcon className="mr-2 size-4" />
                {programsT('detail.printWorkout')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleDelete}
                disabled={deleting}
                className="text-destructive-text focus:text-destructive-text"
              >
                <TrashIcon className="mr-2 size-4" />
                {common('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {catalog.length === 0 && (
          <p className="text-small text-muted-foreground">{t('catalogEmpty')}</p>
        )}
      </div>

      <ProgramExerciseFormDialog
        open={addExoOpen}
        onOpenChange={setAddExoOpen}
        mode="create"
        workoutId={workout.id}
        catalog={catalog}
      />
    </div>
  );
}
