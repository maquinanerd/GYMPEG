'use client';

import { useTranslations } from 'next-intl';
import type { FieldChange, FieldValue, ProgramDiff } from '@/lib/program-snapshot';
import { isEmptyDiff } from '@/lib/program-snapshot';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { useTrainingName } from '@/components/shared/use-training-name';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

// Fields a diff can name (lib/program-snapshot), each with a label under
// programs.history.fields.
const FIELD_KEYS = [
  'name',
  'description',
  'phase',
  'scheduleMode',
  'dayOfWeek',
  'targetSets',
  'targetRepsMin',
  'targetRepsMax',
  'targetRIR',
  'restSec',
  'tempo',
  'notes',
  'supersetGroup',
  'autoregulationMode',
  'fatigueRate',
  'loadAdjustmentPct',
] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function isFieldKey(field: string): field is FieldKey {
  return (FIELD_KEYS as readonly string[]).includes(field);
}

// Renders the difference between two program versions as plain lines.
export function ProgramDiffView({ diff }: { diff: ProgramDiff }) {
  const t = useTranslations('programs.history');
  const programs = useTranslations('programs');
  const common = useTranslations('common');
  const exerciseName = useExerciseName();
  const trainingName = useTrainingName();

  if (isEmptyDiff(diff)) {
    return <p className="text-sm text-muted-foreground">{t('noChanges')}</p>;
  }

  function value(field: string, raw: FieldValue): string {
    if (raw === null || raw === '') return t('diff.empty');
    if (field === 'dayOfWeek' && typeof raw === 'number') {
      const key = DAY_KEYS[raw - 1];
      return key ? common(`days.${key}`) : String(raw);
    }
    if (field === 'autoregulationMode' && (raw === 'PRESERVE_RIR' || raw === 'PRESERVE_REPS')) {
      return t(`autoregulation.${raw}`);
    }
    if (field === 'scheduleMode' && (raw === 'ROTATION' || raw === 'FIXED_DAYS')) {
      return programs(`schedule.${raw}`);
    }
    if (field === 'name' || field === 'phase') return trainingName(String(raw));
    return String(raw);
  }

  function fieldLine(change: FieldChange) {
    const label = isFieldKey(change.field) ? t(`fields.${change.field}`) : change.field;
    return t('diff.field', {
      field: label,
      from: value(change.field, change.from),
      to: value(change.field, change.to),
    });
  }

  return (
    <ul className="space-y-2 text-sm">
      {diff.fields.map((change) => (
        <li key={change.field}>{fieldLine(change)}</li>
      ))}
      {diff.workoutsAdded.map((workout) => (
        <li key={`added-${workout.name}`}>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {t('diff.workoutAdded', { name: trainingName(workout.name) })}
          </span>
          {workout.exercises.length > 0 && (
            <span className="text-muted-foreground">
              {' '}
              ({workout.exercises.map(exerciseName).join(', ')})
            </span>
          )}
        </li>
      ))}
      {diff.workoutsRemoved.map((name) => (
        <li key={`removed-${name}`} className="font-medium text-destructive">
          {t('diff.workoutRemoved', { name: trainingName(name) })}
        </li>
      ))}
      {diff.workoutsChanged.map((workout) => (
        <li key={`changed-${workout.name}`}>
          <p className="font-medium">
            {workout.previousName
              ? t('diff.workoutRenamed', {
                  name: trainingName(workout.name),
                  previous: trainingName(workout.previousName),
                })
              : trainingName(workout.name)}
          </p>
          <ul className="mt-1 space-y-1 border-l border-border pl-3 text-muted-foreground">
            {workout.fields.map((change) => (
              <li key={change.field}>{fieldLine(change)}</li>
            ))}
            {workout.exercisesAdded.map((name) => (
              <li key={`added-${name}`} className="text-emerald-600 dark:text-emerald-400">
                {t('diff.exerciseAdded', { name: exerciseName(name) })}
              </li>
            ))}
            {workout.exercisesRemoved.map((name) => (
              <li key={`removed-${name}`} className="text-destructive">
                {t('diff.exerciseRemoved', { name: exerciseName(name) })}
              </li>
            ))}
            {workout.exercisesChanged.map((exercise, index) => (
              <li key={`changed-${exercise.name}-${index}`}>
                {exercise.previousName && (
                  <span className="block">
                    {t('diff.exerciseSwapped', {
                      previous: exerciseName(exercise.previousName),
                      name: exerciseName(exercise.name),
                    })}
                  </span>
                )}
                {exercise.fields.map((change) => (
                  <span key={change.field} className="block">
                    {exerciseName(exercise.name)} · {fieldLine(change)}
                  </span>
                ))}
              </li>
            ))}
            {workout.reordered && <li>{t('diff.reordered')}</li>}
          </ul>
        </li>
      ))}
    </ul>
  );
}
