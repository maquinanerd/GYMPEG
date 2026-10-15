'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CaretLeftIcon, PlusIcon, PrinterIcon } from '@/components/ui/icon';
import type { Exercise, Program } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { Button, IconButton } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { Tabs } from '@/components/ui/tabs';
import { Tag } from '@/components/ui/tag';
import { ProgramEditDialog } from '@/components/programs/program-edit-dialog';
import { ProgramDeleteButton } from '@/components/programs/program-delete-button';
import { ProgramWorkout, type WorkoutWithExercises } from '@/components/programs/workout-card';
import { WorkoutFormDialog } from '@/components/programs/workout-form-dialog';
import { ProgramHistory } from '@/components/programs/program-history';
import { StartWorkoutButton } from '@/components/session/start-workout-button';
import { cycleWeekAt, isDeloadWeek, programCycle } from '@/lib/program-cycle';
import { useTrainingName } from '@/components/shared/use-training-name';

export type ProgramFull = Program & { workouts: WorkoutWithExercises[] };

interface Props {
  program: ProgramFull;
  catalog: Exercise[];
  // Workout to open first (`?workout=`); the first one otherwise.
  initialWorkoutId?: string | null;
}

// A program, one workout at a time (design v2 "Treino do programa"): back,
// program name, print and "Editar" on top; the workout tabs when there are
// several; the workout sheet; the program's own settings and versions; and
// "Iniciar treino" docked above the tab bar.
export function ProgramDetailView({ program, catalog, initialWorkoutId = null }: Props) {
  const t = useTranslations('programs');
  const workoutT = useTranslations('programs.workout');
  const common = useTranslations('common');
  const trainingName = useTrainingName();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [editWorkoutOpen, setEditWorkoutOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialWorkoutId);
  const cycle = programCycle(program);
  // Computed after mount: the server and the device may sit in other zones.
  const [cycleWeek, setCycleWeek] = useState<number | null>(null);
  useEffect(() => {
    if (!cycle) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setCycleWeek(cycleWeekAt(cycle, new Date(), zone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program.cycleWeeks, program.cycleAnchor]);

  const selected =
    program.workouts.find((workout) => workout.id === selectedId) ?? program.workouts[0] ?? null;
  const programName = trainingName(program.name);

  // Keeps the open workout in the URL, so back/forward and a reload land on it.
  function selectWorkout(id: string) {
    setSelectedId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('workout', id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  async function toggleActive() {
    setActivating(true);
    try {
      const res = await fetch(`/api/programs/${program.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !program.isActive }),
      });
      if (!res.ok) {
        toast.error(t('saveError'));
        return;
      }
      toast.success(program.isActive ? t('deactivated') : t('activated'));
      router.refresh();
    } finally {
      setActivating(false);
    }
  }

  const cycleStatus = cycle
    ? cycleWeek && isDeloadWeek(cycle, cycleWeek)
      ? t('cycle.statusDeload', { week: cycleWeek, weeks: cycle.weeks })
      : t('cycle.status', { week: cycleWeek ?? 1, weeks: cycle.weeks })
    : null;
  const multiple = program.workouts.length > 1;

  return (
    <>
      <header className="flex items-center gap-1 px-2 pt-2">
        <IconButton asChild aria-label={t('detail.back')}>
          <Link href="/programs">
            <CaretLeftIcon />
          </Link>
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
          {programName}
        </span>
        <IconButton asChild aria-label={t('print.action')}>
          <Link href={`/programs/${program.id}/print`}>
            <PrinterIcon />
          </Link>
        </IconButton>
        {selected && (
          <Button
            variant="ghost"
            className="h-12 px-3 text-[0.9375rem]"
            aria-label={workoutT('edit')}
            onClick={() => setEditWorkoutOpen(true)}
          >
            {common('actions.edit')}
          </Button>
        )}
      </header>

      {multiple && selected && (
        <Tabs
          label={t('detail.workouts')}
          idPrefix="program-workout"
          value={selected.id}
          onChange={selectWorkout}
          options={program.workouts.map((workout) => ({
            value: workout.id,
            label: trainingName(workout.name),
          }))}
          className="mt-1"
        />
      )}

      <div className="flex flex-col gap-7 px-5 pb-6 pt-4">
        {selected ? (
          <div
            role={multiple ? 'tabpanel' : undefined}
            id={multiple ? `program-workout-panel-${selected.id}` : undefined}
            aria-labelledby={multiple ? `program-workout-tab-${selected.id}` : undefined}
          >
            <ProgramWorkout
              key={selected.id}
              workout={selected}
              catalog={catalog}
              onEdit={() => setEditWorkoutOpen(true)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.02em]">
              {programName}
            </h1>
            <div className="flex flex-col gap-1">
              <p className="text-subtitle">{t('noSessions')}</p>
              <p className="max-w-prose text-caption text-muted-foreground">
                {t('noSessionsDescription')}
              </p>
            </div>
            <Button variant="ink" size="sm" onClick={() => setAddWorkoutOpen(true)}>
              <PlusIcon weight="bold" />
              {t('addSession')}
            </Button>
          </div>
        )}

        <ProgramHistory programId={program.id} />

        <Section title={t('detail.about')} size="sm" divider>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-semibold">{programName}</span>
              {program.isActive && <Tag variant="primary">{t('active')}</Tag>}
            </div>
            <p className="text-caption text-muted-foreground">
              {[trainingName(program.phase), t(`list.scheduleShort.${program.scheduleMode}`)].join(
                ' · ',
              )}
            </p>
            {cycleStatus && (
              <p data-testid="program-cycle" className="text-caption text-muted-foreground">
                {cycleStatus}
              </p>
            )}
            {program.description && (
              <p className="mt-1 whitespace-pre-line text-[0.9375rem] leading-normal text-pretty">
                {program.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={program.isActive ? 'outline' : 'ink'}
              size="sm"
              onClick={toggleActive}
              loading={activating}
              disabled={activating}
            >
              {program.isActive ? t('deactivate') : t('activate')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              {t('editProgram')}
            </Button>
            {selected && (
              <Button variant="outline" size="sm" onClick={() => setAddWorkoutOpen(true)}>
                <PlusIcon weight="bold" />
                {t('addSession')}
              </Button>
            )}
            <ProgramDeleteButton programId={program.id} programName={programName} />
          </div>
        </Section>
      </div>

      {selected && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-auto border-t border-border bg-card px-5 py-3">
          <StartWorkoutButton
            workoutId={selected.id}
            label={t('detail.startWorkout')}
            disabled={selected.exercises.length === 0}
          />
        </div>
      )}

      <ProgramEditDialog open={editOpen} onOpenChange={setEditOpen} program={program} />
      <WorkoutFormDialog
        open={addWorkoutOpen}
        onOpenChange={setAddWorkoutOpen}
        mode="create"
        programId={program.id}
      />
      {selected && (
        <WorkoutFormDialog
          open={editWorkoutOpen}
          onOpenChange={setEditWorkoutOpen}
          mode="edit"
          workout={selected}
        />
      )}
    </>
  );
}
