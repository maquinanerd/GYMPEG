'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2, RefreshCw, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiConsentCard } from '@/components/ai/ai-consent-card';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';

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
    return <p className="text-sm text-muted-foreground">{t('planner.disabled')}</p>;
  }
  if (!consented) {
    return <AiConsentCard version={consentVersion} onAccepted={() => setConsented(true)} />;
  }

  const weeklySets = validation
    ? (Object.entries(validation.analysis.weeklySetsByMuscle) as [MuscleGroup, number][]).sort(
        (a, b) => b[1] - a[1],
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5" />
            <h2 className="text-base font-semibold">{t('planner.title')}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{t('planner.description')}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-plan-request" className="text-sm">
              {t('planner.requestLabel')}
            </Label>
            <Textarea
              id="ai-plan-request"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('planner.requestPlaceholder')}
            />
          </div>
          <div>
            <Button
              type="button"
              onClick={generate}
              disabled={generating || saving}
              className="min-h-tap"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : plan ? (
                <RefreshCw className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span className="ml-2">{plan ? t('planner.regenerate') : t('planner.generate')}</span>
            </Button>
          </div>
          {generating && (
            <ol className="flex flex-col gap-1 text-sm" aria-live="polite">
              {STEPS.map((name, i) => (
                <li
                  key={name}
                  className={
                    i < step
                      ? 'flex items-center gap-2 text-muted-foreground'
                      : i === step
                        ? 'flex items-center gap-2 font-medium'
                        : 'flex items-center gap-2 text-muted-foreground/50'
                  }
                >
                  {i < step ? (
                    <Check className="size-4" />
                  ) : i === step ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="size-4" />
                  )}
                  {t(`planner.steps.${name}`)}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </CardContent>
      </Card>

      {plan && result && validation && !generating && (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">{plan.title}</h2>
            <p className="text-xs text-muted-foreground">{t('preview.description')}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {plan.rationale && (
              <div className="space-y-1">
                <h3 className="text-sm font-medium">{t('preview.rationale')}</h3>
                <p className="text-sm text-muted-foreground">{plan.rationale}</p>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <h3 className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="size-4" />
                  {t('preview.warnings')}
                </h3>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {validation.warnings
                    .filter((w) => w.code !== 'VOLUME_TOO_HIGH' && w.code !== 'MUSCLE_NOT_COVERED')
                    .map((warning, i) => (
                      <li key={`w-${i}`}>{warningText(warning)}</li>
                    ))}
                  {weeklySets
                    .filter(([, sets]) => sets > PLAN_LIMITS.weeklySetsPerMuscle)
                    .map(([muscle, sets]) => (
                      <li key={`v-${muscle}`}>
                        {t('warnings.VOLUME_TOO_HIGH', { muscle: muscleLabel(muscle), sets })}
                      </li>
                    ))}
                  {validation.analysis.missingMajorGroups.map((group) => (
                    <li key={`m-${group}`}>
                      {t('warnings.MUSCLE_NOT_COVERED', {
                        group: t(`majorGroups.${group as 'chest'}`),
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validation.errors.length > 0 && (
              <p className="text-sm text-rose-600">
                {t('preview.invalid', { reason: validation.errors[0]!.message })}
              </p>
            )}

            {plan.workouts.map((workout, wi) => (
              <section key={wi} className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{workout.name}</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {workout.dayOfWeek
                      ? t(`weekdays.${WEEKDAYS[workout.dayOfWeek - 1]!}`)
                      : t('preview.rotation')}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t('preview.minutes', {
                      minutes: validation.analysis.estimatedMinutes[wi] ?? 0,
                    })}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {workout.exercises.map((exercise, ei) => {
                    const info = result.exercises[exercise.exerciseId];
                    return (
                      <li
                        key={`${exercise.exerciseId}-${ei}`}
                        className="flex items-start gap-2 rounded-md bg-muted/40 p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {info ? getExerciseDisplayName(info.name, locale) : exercise.exerciseId}
                          </p>
                          <p className="text-xs text-muted-foreground">
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
                          </p>
                          {exercise.notes && (
                            <p className="mt-0.5 text-xs italic text-muted-foreground">
                              {exercise.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPlan(withoutExercise(plan, wi, ei))}
                          aria-label={t('preview.removeExercise')}
                        >
                          <Trash2 className="size-4 text-rose-600" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t('preview.weeklySets')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {weeklySets.map(([muscle, sets]) => (
                  <Badge key={muscle} variant="outline" className="text-xs">
                    {muscleLabel(muscle)}: {sets}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => save(true)}
                disabled={saving || !validation.ok || plan.workouts.length === 0}
                className="min-h-tap"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                <span className="ml-2">{t('preview.saveAndActivate')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => save(false)}
                disabled={saving || !validation.ok || plan.workouts.length === 0}
                className="min-h-tap"
              >
                {t('preview.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
