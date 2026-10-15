'use client';

import { useId, useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { CaretDownIcon, DotsThreeIcon } from '@/components/ui/icon';
import type { Exercise, ProgramExercise, WeightUnit } from '@/lib/prisma-client';
import { IconButton } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
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
import { ExerciseMediaFigure } from '@/components/session/exercise-media-figure';
import { formatRestLength, groupedSetsLine } from '@/components/session/session-format';
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
  // The button stays rendered while disabled (during a rest) so the title row
  // keeps its height across the set/rest transition.
  menuDisabled?: boolean;
}

// The exercise of the running workout (design v2): the picture of the
// movement, the name (the screen's h1), the prescription, last time, the
// tags that apply (superset, deload, readiness, availability) and the
// computed load suggestion with its reason. The "…" button opens the exercise
// sheet (replace, add, remove, technique, plates). Straight on the page: no
// card surface.
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
  const titleId = useId();
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const exo = programExercise.exercise;
  const displayName = exerciseName(exo.name);
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
  const bare = (value: number) =>
    formatWeight(value, unit, { decimals: 2, group: false, locale, withUnit: false });
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
        : groupedSetsLine(lastPerformance.sets, bare)
      : null;
  const restLength = formatRestLength(programExercise.restSec, (key, values) => t(key, values));
  const prescription = isCardio
    ? t('cardioPrescription', {
        sets: programExercise.targetSets,
        seconds: programExercise.restSec,
      })
    : [
        t('setsReps', { sets: programExercise.targetSets, reps: repsLabel }),
        t('rir', { rir: programExercise.targetRIR }),
        t('rest', { duration: restLength }),
        programExercise.tempo ? t('tempo', { tempo: programExercise.tempo }) : null,
      ]
        .filter(Boolean)
        .join(' · ');
  // A progression shows its step next to the load ("+2,5"); a step down reads
  // in the reason below.
  const delta =
    suggestion.reason === 'progression' && suggestion.delta ? `+${bare(suggestion.delta)}` : null;

  const hasTags =
    supersetLabel != null ||
    deloadNote != null ||
    readinessNote != null ||
    gymName != null ||
    loadConstraints?.isAvailable === false;

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4">
      <ExerciseMediaFigure
        exerciseName={exo.name}
        displayName={displayName}
        equipmentType={exo.equipmentType}
        muscleGroup={exo.muscleGroup}
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex min-w-0 items-start gap-1">
          <h1
            id={titleId}
            data-testid="exercise-title"
            className="min-w-0 flex-1 text-title text-balance [overflow-wrap:anywhere]"
          >
            {displayName}
          </h1>
          {onOpenMenu && (
            <IconButton
              size="session"
              onClick={onOpenMenu}
              disabled={menuDisabled}
              aria-label={t('actions')}
              title={t('actions')}
              className="-mr-4 -mt-4 min-h-tap min-w-tap shrink-0"
            >
              <DotsThreeIcon />
            </IconButton>
          )}
        </div>
        <p className="text-[0.9375rem] font-medium tabular-nums text-muted-foreground">
          {prescription}
        </p>
        {lastPerformance && (!isCardio || lastPerformance.cardio) && (
          <p className="text-caption text-muted-foreground">
            <span>{t('lastSession', { date: lastDate ?? '' })}</span>:{' '}
            <Num stretch={112} className="text-foreground">
              {isCardio && lastPerformance.cardio
                ? cardioLastLine(lastPerformance.cardio)
                : lastSets}
            </Num>
          </p>
        )}
      </div>

      {hasTags && (
        <div className="flex flex-wrap gap-2">
          {supersetLabel && (
            <Tag variant="info">{sessionT('superset', { label: supersetLabel })}</Tag>
          )}
          {deloadNote && <Tag variant="deload">{deloadNote}</Tag>}
          {readinessNote && <Tag variant="warning">{readinessNote}</Tag>}
          {loadConstraints?.isAvailable === false && (
            <Tag variant="destructive">{t('notAvailable')}</Tag>
          )}
          {gymName && <Tag variant="muted">{gymName}</Tag>}
        </div>
      )}

      {/* Exercise cue (issue #224): the exercise's own technique note, always
          visible while logging. The program note stays collapsible below. */}
      {exo.notes && (
        <p className="whitespace-pre-line text-caption text-muted-foreground">{exo.notes}</p>
      )}

      {!isCardio && suggestion.weight != null && (
        <div className="flex flex-col gap-1 rounded-md bg-accent px-4 py-3.5 text-accent-foreground">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-caption font-semibold">{t('suggestion')}</span>
            <Num stretch={125} className="text-number text-foreground">
              {suggestion.weight === 0 ? t('bodyweight') : kg(suggestion.weight)}
            </Num>
            {delta && <span className="text-caption font-semibold tabular-nums">{delta}</span>}
          </p>
          <p className="text-caption leading-[1.4] text-pretty">{suggestionHelp}</p>
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            className="-my-1 flex min-h-11 items-center self-start rounded-xs text-caption font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('suggestionHelp')}
          </button>
          {helpOpen && <p className="text-caption leading-[1.4] text-pretty">{t('method')}</p>}
        </div>
      )}

      {programExercise.notes && (
        <div>
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            aria-expanded={notesOpen}
            className="flex min-h-11 items-center gap-1.5 rounded-xs text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CaretDownIcon
              className={cn(
                'size-4 transition-transform duration-[120ms] ease-out-quart motion-reduce:transition-none',
                notesOpen && 'rotate-180',
              )}
            />
            {t('notes')}
          </button>
          {notesOpen && (
            // The exercise's own notes are the always-visible cue above; this
            // block holds only the program-specific note so the same text is
            // never shown twice.
            <p className="mt-1 whitespace-pre-line border-l-2 border-border pl-3 text-caption text-muted-foreground">
              {programExercise.notes}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
