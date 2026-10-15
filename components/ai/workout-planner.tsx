'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CheckIcon, TrashIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import type { MuscleGroup } from '@/lib/prisma-client';
import {
  PLAN_LIMITS,
  validateWorkoutPlan,
  type AiWorkoutPlan,
  type PlanCandidate,
  type PlanIssue,
  type PlanValidation,
} from '@/lib/ai/workout-plan';
import { Button, IconButton } from '@/components/ui/button';
import { CoachText } from '@/components/ui/coach-text';
import { Label } from '@/components/ui/label';
import { Num } from '@/components/ui/num';
import { OfflineNotice } from '@/components/ui/screen-state';
import { Tag } from '@/components/ui/tag';
import { Textarea } from '@/components/ui/textarea';
import { AiConsentCard } from '@/components/ai/ai-consent-card';
import { useOnline } from '@/components/auth/use-online';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { cn } from '@/lib/utils';

// Same shape as PlannerResult in lib/ai/planner (server only).
interface PlannerResult {
  plan: AiWorkoutPlan;
  exercises: Record<string, { name: string; primaryMuscles: MuscleGroup[] }>;
  availability: { sessionsPerWeek: number | null; sessionMinutes: number | null };
}

const STEPS = ['context', 'candidates', 'planning', 'validating'] as const;
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// Drops one exercise; a workout left empty goes too, and the order and the
// days per week follow.
function withoutExercise(plan: AiWorkoutPlan, wi: number, ei: number): AiWorkoutPlan {
  const workouts = plan.workouts
    .map((workout, i) =>
      i !== wi
        ? workout
        : {
            ...workout,
            exercises: workout.exercises
              .filter((_, j) => j !== ei)
              .map((exercise, j) => ({ ...exercise, order: j + 1 })),
          },
    )
    .filter((workout) => workout.exercises.length > 0);
  return { ...plan, workouts, daysPerWeek: workouts.length };
}

// The AI plan flow (addendum 02): GENERATE → schema → domain validation →
// PREVIEW (edited here, re-validated on every edit) → the lifter confirms →
// SAVE. What the AI wrote (the rationale, exercise notes) reads in italic;
// every number shown is the plan's or the validation's, never invented here.
export function WorkoutPlanner({
  initialConsent,
  consentVersion,
  enabled,
}: {
  initialConsent: boolean;
  consentVersion: string;
  enabled: boolean;
}) {
  const t = useTranslations('ai');
  const exerciseT = useTranslations('exercises');
  const locale = useLocale();
  const router = useRouter();
  const online = useOnline();
  const [consented, setConsented] = useState(initialConsent);
  const [request, setRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [plan, setPlan] = useState<AiWorkoutPlan | null>(null);
  const [saving, setSaving] = useState(false);

  // The steps only tell the lifter what is going on; they advance on a timer
  // and wait on the last one until the answer arrives.
  useEffect(() => {
    if (!generating) return;
    setStep(0);
    const timer = setInterval(
      () => setStep((current) => Math.min(current + 1, STEPS.length - 1)),
      1800,
    );
    return () => clearInterval(timer);
  }, [generating]);

  // The domain validation runs again on every edit, in the browser.
  const validation: PlanValidation | null = useMemo(() => {
    if (!result || !plan) return null;
    const candidates = new Map<string, PlanCandidate>(
      Object.entries(result.exercises).map(([id, exercise]) => [
        id,
        { id, name: exercise.name, primaryMuscles: exercise.primaryMuscles, equipment: [] },
      ]),
    );
    return validateWorkoutPlan(plan, {
      candidates,
      availableEquipment: [],
      avoidedIds: new Set(),
      sessionsPerWeek: result.availability.sessionsPerWeek,
      sessionMinutes: result.availability.sessionMinutes,
    });
  }, [result, plan]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/workout-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, idempotencyKey: crypto.randomUUID() }),
      });
      const body = (await res.json().catch(() => ({}))) as PlannerResult & { error?: string };
      if (!res.ok) {
        if (body.error === 'AI_CONSENT_REQUIRED') {
          setConsented(false);
          return;
        }
        throw new Error(body.error === 'AI_FEATURE_DISABLED' ? t('planner.disabled') : body.error);
      }
      setResult(body);
      setPlan(body.plan);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('planner.error'));
    } finally {
      setGenerating(false);
    }
  }

  async function save(activate: boolean) {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/workout-plan/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, activate }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !body.id) throw new Error(body.error ?? t('preview.saveError'));
      toast.success(t('preview.saved'));
      router.push(`/programs/${body.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('preview.saveError'));
      setSaving(false);
    }
  }

  const muscleLabel = (group: MuscleGroup) =>
    exerciseT(`muscleGroups.${muscleGroupMessageKeys[group]}`);

  function warningText(issue: PlanIssue): string {
    if (!plan || !validation || !result) return issue.message;
    switch (issue.code) {
      case 'SESSIONS_DIFFER_FROM_AVAILABILITY':
        return t('warnings.SESSIONS_DIFFER_FROM_AVAILABILITY', {
          workouts: plan.workouts.length,
          sessions: result.availability.sessionsPerWeek ?? 0,
        });
      case 'TOO_LONG': {
        const index = Number(issue.path.split('.')[1]);
        return t('warnings.TOO_LONG', {
          workout: plan.workouts[index]?.name ?? '',
          minutes: result.availability.sessionMinutes ?? 0,
        });
      }
      default:
        return issue.message;
    }
  }

  if (!enabled) {
    return <p className="text-caption text-muted-foreground">{t('planner.disabled')}</p>;
  }
  if (!consented) {
    return <AiConsentCard version={consentVersion} onAccepted={() => setConsented(true)} />;
  }

  const weeklySets = validation
    ? (Object.entries(validation.analysis.weeklySetsByMuscle) as [MuscleGroup, number][]).sort(
        (a, b) => b[1] - a[1],
      )
    : [];
  const warnings = validation
    ? [
        ...validation.warnings
          .filter((w) => w.code !== 'VOLUME_TOO_HIGH' && w.code !== 'MUSCLE_NOT_COVERED')
          .map((warning, i) => ({ key: `w-${i}`, text: warningText(warning) })),
        ...weeklySets
          .filter(([, sets]) => sets > PLAN_LIMITS.weeklySetsPerMuscle)
          .map(([muscle, sets]) => ({
            key: `v-${muscle}`,
            text: t('warnings.VOLUME_TOO_HIGH', { muscle: muscleLabel(muscle), sets }),
          })),
        ...validation.analysis.missingMajorGroups.map((group) => ({
          key: `m-${group}`,
          text: t('warnings.MUSCLE_NOT_COVERED', { group: t(`majorGroups.${group as 'chest'}`) }),
        })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="ai-planner-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="ai-planner-title" className="text-heading">
            {t('planner.title')}
          </h2>
          <p className="max-w-prose text-caption text-muted-foreground text-pretty">
            {t('planner.description')}
          </p>
        </div>
        {!online && <OfflineNotice>{t('planner.offline')}</OfflineNotice>}
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-plan-request">{t('planner.requestLabel')}</Label>
          <Textarea
            id="ai-plan-request"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t('planner.requestPlaceholder')}
          />
        </div>
        <Button
          type="button"
          variant={plan ? 'outline' : 'primary'}
          onClick={generate}
          loading={generating}
          disabled={generating || saving}
          className="w-full"
        >
          {plan ? t('planner.regenerate') : t('planner.generate')}
        </Button>
        {generating && (
          <ol className="flex flex-col gap-1.5 text-caption" aria-live="polite">
            {STEPS.map((name, i) => (
              <li
                key={name}
                className={cn(
                  'flex items-center gap-2',
                  i < step && 'text-muted-foreground',
                  i === step && 'font-semibold',
                  i > step && 'text-muted-foreground',
                )}
              >
                {i < step ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <span aria-hidden className="size-4" />
                )}
                {t(`planner.steps.${name}`)}
              </li>
            ))}
          </ol>
        )}
        {error && (
          <p role="alert" className="text-caption text-destructive-text">
            {error}
          </p>
        )}
      </section>

      {plan && result && validation && !generating && (
        <section
          aria-labelledby="ai-plan-title"
          className="flex flex-col gap-5 border-t border-border pt-5"
        >
          <div className="flex flex-col gap-1">
            <h2 id="ai-plan-title" className="text-heading">
              {plan.title}
            </h2>
            <p className="text-caption text-muted-foreground">{t('preview.description')}</p>
          </div>

          {plan.rationale && (
            <CoachText label={t('preview.rationale')}>{plan.rationale}</CoachText>
          )}

          {warnings.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md bg-muted px-4 py-3">
              <h3 className="text-caption font-semibold text-warning-text">
                {t('preview.warnings')}
              </h3>
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-caption">
                {warnings.map((warning) => (
                  <li key={warning.key}>{warning.text}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.errors.length > 0 && (
            <p role="alert" className="text-caption text-destructive-text">
              {t('preview.invalid', { reason: validation.errors[0]!.message })}
            </p>
          )}

          {plan.workouts.map((workout, wi) => (
            <section key={wi} className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <h3 className="text-subtitle">{workout.name}</h3>
                <Tag variant="muted">
                  {workout.dayOfWeek
                    ? t(`weekdays.${WEEKDAYS[workout.dayOfWeek - 1]!}`)
                    : t('preview.rotation')}
                </Tag>
                <Num stretch={108} className="ml-auto text-caption text-muted-foreground">
                  {t('preview.minutes', {
                    minutes: validation.analysis.estimatedMinutes[wi] ?? 0,
                  })}
                </Num>
              </div>
              <ol>
                {workout.exercises.map((exercise, ei) => {
                  const info = result.exercises[exercise.exerciseId];
                  return (
                    <li
                      key={`${exercise.exerciseId}-${ei}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-t border-border py-2.5"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-body font-semibold">
                          {info ? getExerciseDisplayName(info.name, locale) : exercise.exerciseId}
                        </p>
                        <Num stretch={108} className="text-caption font-medium text-muted-foreground">
                          {[
                            t('preview.prescription', {
                              sets: exercise.sets,
                              min: exercise.repMin,
                              max: exercise.repMax,
                            }),
                            exercise.targetRir != null
                              ? t('preview.rir', { rir: exercise.targetRir })
                              : null,
                            t('preview.rest', { seconds: exercise.restSeconds }),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Num>
                        {exercise.notes && (
                          <p className="text-[0.8125rem] font-medium italic text-pretty">
                            {exercise.notes}
                          </p>
                        )}
                      </div>
                      <IconButton
                        type="button"
                        size="sm"
                        className="-mr-3 -mt-2 text-destructive-text"
                        onClick={() => setPlan(withoutExercise(plan, wi, ei))}
                        aria-label={t('preview.removeExercise')}
                      >
                        <TrashIcon />
                      </IconButton>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-caption font-semibold">{t('preview.weeklySets')}</h3>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 font-num text-caption font-semibold tabular-nums stretch-108">
              {weeklySets.map(([muscle, sets]) => (
                <li key={muscle}>
                  {muscleLabel(muscle)}: {sets}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => save(true)}
              loading={saving}
              disabled={saving || !validation.ok || plan.workouts.length === 0}
              className="w-full"
            >
              {t('preview.saveAndActivate')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => save(false)}
              disabled={saving || !validation.ok || plan.workouts.length === 0}
              className="w-full"
            >
              {t('preview.save')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
