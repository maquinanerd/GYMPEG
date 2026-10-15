'use client';

import { useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  ClockIcon,
  DotsThreeIcon,
  GaugeIcon,
  LightbulbIcon,
  StackIcon,
  TimerIcon,
  type AppIcon,
} from '@/components/ui/icon';
import type { Exercise, ProgramExercise, WeightUnit } from '@/lib/prisma-client';
import { Tag } from '@/components/ui/tag';
import {
  suggestNextWeight,
  SORENESS_HOLD_AT_OR_ABOVE,
  type ReadinessSignal,
} from '@/lib/progression';
import { formatWeight } from '@/lib/units';
import { formatCardioSet } from '@/lib/cardio';
import type { SerializedLastPerformance } from './session-runner';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import { getExerciseMedia } from '@/lib/exercise-media';
import { ExerciseMediaDialog } from '@/components/exercises/exercise-media-dialog';
import { cn } from '@/lib/utils';

// Non-breaking hyphen (U+2011): a rep range never splits across lines.
const RANGE_DASH = '‑';

// Last-session reference line for a cardio exercise (issue #176): duration and
// distance via the shared cardio formatter, with average heart rate appended
// when the previous session recorded one. Distance and bpm are simply omitted
// when absent, so a duration-only cardio set shows just the duration.
function cardioLastLine(cardio: NonNullable<SerializedLastPerformance['cardio']>): string {
  const base = formatCardioSet(cardio.durationSec, cardio.distanceM);
  return cardio.avgHr != null ? `${base} · ${cardio.avgHr} bpm` : base;
}

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  lastPerformance: SerializedLastPerformance | undefined;
  readiness: ReadinessSignal | null;
  // True while a planned deload week is active (issue #112).
  deloadActive: boolean;
  unit: WeightUnit;
  gymName?: string | null;
  loadConstraints?: GymLoadConstraints | null;
  // "A1", "A2"... when the exercise belongs to a superset (issue #146).
  supersetLabel?: string | null;
  onOpenMenu?: () => void;
  // The button stays rendered while disabled (during a rest) so the header
  // keeps its height across the set/rest transition.
  menuDisabled?: boolean;
}

// The exercise of the running workout (design round 1): name, prescription,
// last session, the computed load suggestion with its reason, and the tags
// (superset, deload, readiness, availability) when they apply. The "…"
// button opens the exercise sheet (replace, add, remove, technique, plates).
// When the exercise has technique frames, the start frame sits next to the
// name and opens the start/finish animation.
export function ExerciseCard({
  programExercise,
  lastPerformance,
  readiness,
  deloadActive,
  unit,
  gymName = null,
  loadConstraints = null,
  supersetLabel = null,
  onOpenMenu,
  menuDisabled = false,
}: Props) {
  const t = useTranslations('session.exerciseCard');
  const sessionT = useTranslations('session');
  const locale = useLocale();
  const exerciseName = useExerciseName();
  const format = useFormatter();
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const exo = programExercise.exercise;
  const hasMedia = getExerciseMedia(exo.name) != null;
  // Cardio exercises (issue #133) are duration/distance based: the weight x
  // reps targets, load suggestion and last-performance load make no sense for
  // them, so those blocks are hidden.
  const isCardio = exo.category === 'CARDIO';

  const repsLabel =
    programExercise.targetRepsMin === programExercise.targetRepsMax
      ? `${programExercise.targetRepsMin}`
      : `${programExercise.targetRepsMin}${RANGE_DASH}${programExercise.targetRepsMax}`;

  const suggestion = suggestNextWeight(
    programExercise,
    lastPerformance?.sets ?? [],
    readiness,
    deloadActive,
    loadConstraints,
    unit,
  );
  const groupSoreness = readiness?.soreness?.[exo.muscleGroup];
  const sorenessHigh =
    typeof groupSoreness === 'number' && groupSoreness >= SORENESS_HOLD_AT_OR_ABOVE;
  const readinessNote =
    suggestion.reason === 'readiness-deload'
      ? t(sorenessHigh ? 'readiness.sorenessLighter' : 'readiness.readinessLighter')
      : suggestion.reason === 'readiness-hold'
        ? t(sorenessHigh ? 'readiness.sorenessHeld' : 'readiness.readinessHeld')
        : null;
  const deloadNote =
    suggestion.reason === 'planned-deload'
      ? t('readiness.planned')
      : deloadActive
        ? sessionT('deloadWeek')
        : null;
  const kg = (value: number) => formatWeight(value, unit, { decimals: 2, group: false, locale });
  const working = kg(suggestion.workingWeight ?? 0);
  const suggestionHelp =
    suggestion.reason === 'progression'
      ? t('help.progression', {
          reps: suggestion.targetRepsMax ?? programExercise.targetRepsMax,
          weight: working,
          delta: kg(suggestion.delta ?? 0),
        })
      : suggestion.reason === 'below-range'
        ? t('help.belowRange', {
            reps: programExercise.targetRepsMin,
            weight: working,
            delta: kg(Math.abs(suggestion.delta ?? 0)),
          })
        : suggestion.reason === 'readiness-hold'
          ? t('help.readinessHold', { weight: working })
          : suggestion.reason === 'readiness-deload'
            ? t('help.readinessDeload', { weight: working })
            : suggestion.reason === 'planned-deload'
              ? t('help.plannedDeload', { weight: working })
              : t('help.hold', {
                  reps: suggestion.targetRepsMax ?? programExercise.targetRepsMax,
                });
  const lastDate = lastPerformance
    ? format.dateTime(new Date(lastPerformance.sessionStartedAt), {
        day: '2-digit',
        month: '2-digit',
      })
    : null;
  const lastSets =
    lastPerformance && !isCardio
      ? lastPerformance.maxWeight === 0
        ? t('bodyweightReps', { reps: lastPerformance.repsAtMaxWeight })
        : lastPerformance.sets
            .map(
              (set) =>
                `${formatWeight(set.weight, unit, { decimals: 2, group: false, locale, withUnit: false })} × ${set.reps}`,
            )
            .join(' · ')
      : null;

  const hasTags =
    supersetLabel != null ||
    deloadNote != null ||
    readinessNote != null ||
    gymName != null ||
    loadConstraints?.isAvailable === false;

  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-lg border border-border bg-card px-4 pb-4 pt-5">
      <div className="flex min-w-0 items-start gap-3">
        {hasMedia && (
          <ExerciseMediaDialog
            exerciseName={exo.name}
            displayName={exerciseName(exo.name)}
            equipmentType={exo.equipmentType}
            compact
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            data-testid="exercise-title-scroll"
            className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <h2 className="w-max min-w-full whitespace-nowrap text-title">
              {exerciseName(exo.name)}
            </h2>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-caption text-muted-foreground tabular-nums">
            {isCardio ? (
              <MetaItem icon={StackIcon}>
                {t('cardioPrescription', {
                  sets: programExercise.targetSets,
                  seconds: programExercise.restSec,
                })}
              </MetaItem>
            ) : (
              <>
                <MetaItem icon={StackIcon}>
                  {t('setsReps', { sets: programExercise.targetSets, reps: repsLabel })}
                </MetaItem>
                <MetaItem icon={GaugeIcon}>{t('rir', { rir: programExercise.targetRIR })}</MetaItem>
                <MetaItem icon={TimerIcon}>
                  {t('rest', { seconds: programExercise.restSec })}
                </MetaItem>
                {programExercise.tempo && (
                  <MetaItem icon={ClockIcon}>
                    {t('tempo', { tempo: programExercise.tempo })}
                  </MetaItem>
                )}
              </>
            )}
          </div>
        </div>
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            disabled={menuDisabled}
            aria-label={t('actions')}
            className="-mr-1 -mt-2 flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-full bg-pill text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <DotsThreeIcon className="size-6" aria-hidden />
          </button>
        )}
      </div>

      {hasTags && (
        <div className="flex flex-wrap gap-2">
          {supersetLabel && <Tag dot="info">{sessionT('superset', { label: supersetLabel })}</Tag>}
          {deloadNote && <Tag dot="deload">{deloadNote}</Tag>}
          {readinessNote && <Tag dot="warning">{readinessNote}</Tag>}
          {loadConstraints?.isAvailable === false && (
            <Tag dot="destructive">{t('notAvailable')}</Tag>
          )}
          {gymName && <Tag>{gymName}</Tag>}
        </div>
      )}

      {/* Exercise cue (issue #224): the exercise's own technique note, always
          visible while logging. The program note stays collapsible below. */}
      {exo.notes && (
        <p className="flex items-start gap-1.5 text-caption text-muted-foreground">
          <LightbulbIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="whitespace-pre-line">{exo.notes}</span>
        </p>
      )}

      {lastPerformance && (!isCardio || lastPerformance.cardio) && (
        <p className="text-caption text-muted-foreground tabular-nums">
          <span>{t('lastSession', { date: lastDate ?? '' })}</span>:{' '}
          <span>
            {isCardio && lastPerformance.cardio ? cardioLastLine(lastPerformance.cardio) : lastSets}
          </span>
        </p>
      )}

      {!isCardio && suggestion.weight != null && (
        <div className="flex flex-col gap-1.5 rounded-[18px] bg-suggestion p-3.5 text-suggestion-foreground">
          <p className="text-subtitle tabular-nums">
            {t('suggestion')}{' '}
            <span>{suggestion.weight === 0 ? t('bodyweight') : kg(suggestion.weight)}</span>
            {suggestion.reason === 'progression' && suggestion.delta ? (
              <span className="ml-1 text-caption">(+{kg(suggestion.delta)})</span>
            ) : null}
          </p>
          <p className="text-caption [text-wrap:pretty]">{suggestionHelp}</p>
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            className="flex min-h-11 items-center gap-1 self-start rounded-pill text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('suggestionHelp')}
            <CaretRightIcon
              className={cn(
                'size-3.5 transition-transform motion-reduce:transition-none',
                helpOpen && 'rotate-90',
              )}
              aria-hidden
            />
          </button>
          {helpOpen && <p className="text-caption [text-wrap:pretty]">{t('method')}</p>}
        </div>
      )}

      {programExercise.notes && (
        <div>
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            aria-expanded={notesOpen}
            className="flex min-h-11 items-center gap-1.5 rounded-pill text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {notesOpen ? <CaretUpIcon className="size-4" /> : <CaretDownIcon className="size-4" />}
            {t('notes')}
          </button>
          {notesOpen && (
            // The exercise's own notes are the always-visible cue above; this
            // block holds only the program-specific note so the same text is
            // never shown twice.
            <p className="mt-1 whitespace-pre-line rounded-sm bg-pill p-3 text-caption text-muted-foreground">
              {programExercise.notes}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function MetaItem({ icon: Glyph, children }: { icon: AppIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <Glyph className="size-4" />
      {children}
    </span>
  );
}
