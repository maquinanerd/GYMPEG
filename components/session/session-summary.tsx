'use client';

import { useId, useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CaretLeftIcon } from '@/components/ui/icon';
import type { Exercise, ProgramExercise, Session, WeightUnit } from '@/lib/prisma-client';
import { Button, IconButton } from '@/components/ui/button';
import { Highlight } from '@/components/ui/highlight';
import { LimeBlock } from '@/components/ui/lime-block';
import { Num } from '@/components/ui/num';
import { OfflineNotice } from '@/components/ui/screen-state';
import { Textarea } from '@/components/ui/textarea';
import { useSyncState } from '@/components/offline/sync-status';
import { copyText } from '@/components/history/copy-workout-button';
import type { PendingSet } from '@/lib/indexeddb';
import { formatWeight } from '@/lib/units';
import { detectPRs, type PRType } from '@/lib/records';
import { calculateE1RM } from '@/lib/training-engine/records';
import { formatCardioSet, formatPace, formatSpeed } from '@/lib/cardio';
import { formatWorkoutText } from '@/lib/workout-text';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { groupedSetsLine } from '@/components/session/session-format';
import { cn } from '@/lib/utils';

// Prior (previous-session) non-warmup sets per exerciseId, used as the PR
// baseline. Same source as the in-session badge (getLastPerformances): a PR
// here means "beats your last session", not an all-time record.
type PriorSets = Record<string, { weight: number; reps: number }[]>;

interface Props {
  session: Session;
  // Display name of the workout ("Treino A").
  workoutName?: string;
  sets: PendingSet[];
  programExercises: (ProgramExercise & { exercise: Exercise })[];
  unit: WeightUnit;
  // Previous-session sets per exercise; absent entries mean no prior history.
  priorSets?: PriorSets;
  onBack: () => void;
  // Receives the notes to save with the finish, or null when unchanged.
  onFinish: (notes: string | null) => Promise<void> | void;
  finishing: boolean;
}

export interface SessionPR {
  exerciseId: string;
  exerciseName: string;
  // The PR types achieved by any working set of this exercise this session.
  types: PRType[];
  // The heaviest working load of this session for the exercise (for display).
  bestWeight: number;
  // Heaviest load of the baseline (last session), null without history.
  previousBestWeight: number | null;
  // Best capped e1RM of this session and of the baseline (lib/records' formula).
  bestE1rm: number | null;
  previousBestE1rm: number | null;
}

function bestE1rmOf(sets: { weight: number; reps: number }[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const e1rm = calculateE1RM(set.weight, set.reps);
    if (e1rm != null && (best == null || e1rm > best)) best = e1rm;
  }
  return best;
}

// Computes which exercises set a personal record during this session. PR math
// is reused from lib/records (detectPRs); the comparison baseline is the prior
// session's sets plus any earlier working set of the same exercise this
// session, so a set is never compared against itself.
export function computeSessionPRs(
  sets: PendingSet[],
  programExercises: (ProgramExercise & { exercise: Exercise })[],
  priorSets: PriorSets,
): SessionPR[] {
  const prs: SessionPR[] = [];
  const seen = new Set<string>();

  for (const pe of programExercises) {
    // A workout may list the same exercise more than once; the PR is per
    // exercise, so process each exerciseId at most once (also keeps React keys
    // unique below).
    if (seen.has(pe.exerciseId)) continue;
    seen.add(pe.exerciseId);

    const exoSets = sets.filter((s) => s.exerciseId === pe.exerciseId && !s.isWarmup);
    if (exoSets.length === 0) continue;

    const prior = priorSets[pe.exerciseId] ?? [];
    const baseline = prior.map((s) => ({ ...s, isWarmup: false }));
    const achieved = new Set<PRType>();
    const earlier: { weight: number; reps: number; isWarmup: boolean }[] = [];

    for (const set of exoSets) {
      const candidate = { weight: set.weight, reps: set.reps, isWarmup: false };
      for (const type of detectPRs(candidate, [...baseline, ...earlier])) {
        achieved.add(type);
      }
      earlier.push(candidate);
    }

    if (achieved.size === 0) continue;

    // Preserve a stable type order: weight before e1rm.
    const types: PRType[] = (['weight', 'e1rm'] as PRType[]).filter((t) => achieved.has(t));
    prs.push({
      exerciseId: pe.exerciseId,
      exerciseName: pe.exercise.name,
      types,
      bestWeight: Math.max(...exoSets.map((s) => s.weight)),
      previousBestWeight: prior.length > 0 ? Math.max(...prior.map((s) => s.weight)) : null,
      bestE1rm: bestE1rmOf(exoSets),
      previousBestE1rm: bestE1rmOf(prior),
    });
  }

  return prs;
}

// The heaviest load of a list of sets and the most reps done with it.
function topSet(sets: { weight: number; reps: number }[]): { weight: number; reps: number } {
  const weight = Math.max(...sets.map((s) => s.weight));
  const reps = Math.max(...sets.filter((s) => s.weight === weight).map((s) => s.reps));
  return { weight, reps };
}

// "Treino concluído" (design v2): the lime block with the time range, the
// title and duration / sets / volume; the offline note while the workout is
// still on the device; the records; every exercise with its sets and how it
// moved since last time; the note; then "Copy workout" and "Save and exit".
export function SessionSummary({
  session,
  workoutName,
  sets,
  programExercises,
  unit,
  priorSets = {},
  onBack,
  onFinish,
  finishing,
}: Props) {
  const t = useTranslations('session.summary');
  const setsT = useTranslations('session.setsList');
  const copyT = useTranslations('history.copy');
  const detailT = useTranslations('history.detail');
  const locale = useLocale();
  const format = useFormatter();
  const exerciseName = useExerciseName();
  const recordsId = useId();
  const exercisesId = useId();
  const { state: syncState } = useSyncState();
  const [notes, setNotes] = useState(session.notes ?? '');
  // Fixed when the summary opens, so the range and duration hold still.
  const [endedAt] = useState(() => new Date());

  const sessionPRs = computeSessionPRs(sets, programExercises, priorSets);
  const startedAt = new Date(session.startedAt);

  const durationMin = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
  const totalSets = sets.filter((s) => !s.isWarmup).length;
  // Cardio sets (issue #133) store reps = 1 / weight = 0 by convention, so
  // they are excluded from the rep count (and contribute 0 to the volume).
  const totalReps = sets.reduce((acc, s) => acc + (s.durationSec != null ? 0 : s.reps), 0);
  const totalVolume = sets.reduce(
    (acc, s) => acc + (s.durationSec != null ? 0 : s.weight * s.reps),
    0,
  );
  const kg = (value: number) => formatWeight(value, unit, { decimals: 2, group: false, locale });
  const time = (date: Date) => format.dateTime(date, { hour: '2-digit', minute: '2-digit' });
  const range = Number.isFinite(startedAt.getTime())
    ? `${format.dateTime(startedAt, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${time(startedAt)} – ${time(endedAt)}`
    : null;

  const exerciseStats = programExercises.map((pe) => {
    const exoSets = sets.filter((s) => s.exerciseId === pe.exerciseId && !s.isWarmup);
    const isCardio = pe.exercise.category === 'CARDIO';
    const prior = priorSets[pe.exerciseId] ?? [];
    // How the exercise moved since last time, by its top set: a heavier load,
    // more reps on the same load, or the same load.
    let delta: { text: string; up: boolean } | null = null;
    if (exoSets.length === 0) delta = { text: t('notDone'), up: false };
    else if (!isCardio && prior.length === 0) delta = { text: t('firstTime'), up: false };
    else if (!isCardio) {
      const today = topSet(exoSets);
      const before = topSet(prior);
      const diff = today.weight - before.weight;
      if (diff > 0) delta = { text: t('loadUp', { weight: kg(diff) }), up: true };
      else if (diff < 0) delta = { text: t('loadDown', { weight: kg(-diff) }), up: false };
      else if (today.reps > before.reps)
        delta = { text: t('repsUp', { count: today.reps - before.reps }), up: true };
      else delta = { text: t('sameLoad'), up: false };
    }
    return {
      pe,
      delta,
      // Cardio recap: total duration and distance across the logged sets,
      // plus derived pace and speed (issue #177) when the session covered a
      // distance. Pace/speed are omitted for duration-only cardio.
      line:
        exoSets.length === 0
          ? null
          : isCardio
            ? cardioRecap(
                exoSets.reduce((acc, s) => acc + (s.durationSec ?? 0), 0),
                exoSets.reduce((acc, s) => acc + (s.distanceM ?? 0), 0),
                unit,
              )
            : groupedSetsLine(exoSets, (weight) =>
                weight === 0 && pe.exercise.usesBodyweight ? setsT('bodyweight') : kg(weight),
              ),
    };
  });

  async function handleClose() {
    // Changed notes travel with the finish (through the offline outbox), so
    // closing works without a network.
    await onFinish(notes && notes !== (session.notes ?? '') ? notes : null);
  }

  async function handleCopy() {
    const seen = new Set<string>();
    const text = formatWorkoutText(
      {
        title: workoutName ?? '',
        date: Number.isFinite(startedAt.getTime())
          ? format.dateTime(startedAt, { day: 'numeric', month: 'long', year: 'numeric' })
          : '',
        notes: notes || null,
        exercises: programExercises.flatMap((pe) => {
          if (seen.has(pe.exerciseId)) return [];
          seen.add(pe.exerciseId);
          return [
            {
              name: exerciseName(pe.exercise.name),
              isCardio: pe.exercise.category === 'CARDIO',
              usesBodyweight: pe.exercise.usesBodyweight,
              sets: sets
                .filter((s) => s.exerciseId === pe.exerciseId)
                .map((s) => ({
                  setNumber: s.setNumber,
                  weight: s.weight,
                  reps: s.reps,
                  isWarmup: s.isWarmup,
                  isDropSet: s.isDropSet,
                  durationSec: s.durationSec ?? null,
                  distanceM: s.distanceM ?? null,
                  notes: s.notes,
                })),
            },
          ];
        }),
      },
      {
        unit,
        locale,
        labels: {
          warmup: copyT('warmup'),
          dropSet: copyT('dropSet'),
          bodyweight: detailT('bodyweight'),
          setNote: (number) => detailT('setNote', { number }),
          notes: copyT('notes'),
        },
      },
    );
    if (await copyText(text)) toast.success(copyT('copied'));
    else toast.error(copyT('error'));
  }

  return (
    <main className="flex flex-1 flex-col">
      <LimeBlock
        as="header"
        className="gap-0 px-0 pb-[1.375rem] pt-[calc(0.25rem+env(safe-area-inset-top))]"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-[1.125rem] px-5">
          <div className="-mb-2 -ml-3 flex items-center gap-1">
            <IconButton
              onClick={onBack}
              aria-label={t('back')}
              title={t('back')}
              className="hover:bg-ink/10"
            >
              <CaretLeftIcon />
            </IconButton>
            {range && (
              <span className="text-caption font-semibold tabular-nums text-brand-strong">
                {range}
              </span>
            )}
          </div>
          <h1 className="text-[2.375rem] font-semibold leading-none tracking-[-0.025em]">
            {workoutName && (
              <>
                {workoutName}
                <br />
              </>
            )}
            {t('completed')}
          </h1>
          <dl className="grid grid-cols-3 gap-3 border-t border-ink/15 pt-3.5">
            <div>
              <dt className="text-[0.8125rem] font-semibold text-brand-strong">{t('duration')}</dt>
              <dd className="mt-1">
                <Num stretch={118} className="text-[1.5rem] leading-none">
                  {t('minutes', { count: durationMin })}
                </Num>
              </dd>
            </div>
            <div>
              <dt className="text-[0.8125rem] font-semibold text-brand-strong">{t('sets')}</dt>
              <dd className="mt-1">
                <Num stretch={118} className="text-[1.5rem] leading-none">
                  {totalSets}
                </Num>
              </dd>
            </div>
            <div>
              <dt className="text-[0.8125rem] font-semibold text-brand-strong">{t('volume')}</dt>
              <dd className="mt-1" title={t('volumeFormula', { reps: totalReps })}>
                <Num stretch={118} className="text-[1.5rem] leading-none">
                  {formatWeight(totalVolume, unit, { decimals: 0, locale, withUnit: false })}
                  <span className="text-caption font-semibold stretch-100">
                    {' '}
                    {unit === 'LB' ? 'lb' : 'kg'}
                  </span>
                </Num>
              </dd>
            </div>
          </dl>
        </div>
      </LimeBlock>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
        {syncState !== 'synced' && <OfflineNotice>{t('offlineNotice')}</OfflineNotice>}

        {sessionPRs.length > 0 && (
          <section aria-labelledby={recordsId} className="flex flex-col">
            <h2 id={recordsId} className="mb-1.5 text-heading" title={t('recordsHint')}>
              {t('records', { count: sessionPRs.length })}
            </h2>
            <ul>
              {sessionPRs.map((pr) => {
                const byWeight = pr.types.includes('weight');
                const label = byWeight ? t('heaviest') : t('bestOneRm');
                const previous = byWeight ? pr.previousBestWeight : pr.previousBestE1rm;
                const value = byWeight ? pr.bestWeight : (pr.bestE1rm ?? pr.bestWeight);
                return (
                  <li
                    key={pr.exerciseId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-3.5"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-body font-semibold">
                        {exerciseName(pr.exerciseName)}
                      </span>
                      <span className="text-[0.8125rem] font-medium text-muted-foreground">
                        {previous != null && previous > 0
                          ? t('before', { label, value: kg(previous) })
                          : label}
                      </span>
                    </span>
                    <Highlight className="text-body">{kg(value)}</Highlight>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby={exercisesId} className="flex flex-col">
          <h2 id={exercisesId} className="mb-1.5 text-heading">
            {t('byExercise')}
          </h2>
          <ul>
            {exerciseStats.map((s) => (
              <li
                key={s.pe.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-border py-3"
              >
                <span className="text-body font-semibold">{exerciseName(s.pe.exercise.name)}</span>
                <span
                  className={cn(
                    'text-right text-[0.8125rem] font-semibold tabular-nums',
                    s.delta?.up ? 'text-brand' : 'text-muted-foreground',
                  )}
                >
                  {s.delta?.text}
                </span>
                {s.line && (
                  <Num
                    stretch={112}
                    className="col-span-2 text-caption font-medium text-muted-foreground"
                  >
                    {s.line}
                  </Num>
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-2">
          <label htmlFor="session-notes" className="text-caption font-semibold">
            {t('note')}
          </label>
          <Textarea
            id="session-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notePlaceholder')}
            className="resize-none"
          />
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Button variant="outline" onClick={() => void handleCopy()} className="px-[1.125rem]">
            {t('copy')}
          </Button>
          <Button onClick={handleClose} disabled={finishing} loading={finishing} className="flex-1">
            {finishing ? t('finishing') : t('finish')}
          </Button>
        </div>
      </footer>
    </main>
  );
}

// Cardio recap line for a session's totals: "30:00 · 5 km · 6:00 /km · 10 km/h".
// Pace and speed (issue #177) are appended only when the session covered a
// distance; a duration-only cardio session shows just the duration.
function cardioRecap(durationSec: number, distanceM: number, unit: WeightUnit): string {
  const base = formatCardioSet(durationSec, distanceM);
  const pace = formatPace(durationSec, distanceM, unit);
  const speed = formatSpeed(durationSec, distanceM, unit);
  return [base, pace, speed].filter(Boolean).join(' · ');
}
