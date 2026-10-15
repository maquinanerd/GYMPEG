'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { CoachContextSummary } from '@/lib/coach-context';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface Props {
  summary: CoachContextSummary;
}

// "What your coach sees" (issue #154, display-only): label · value rows of
// the same payload sections the AI debrief receives, so the user can verify
// at a glance that the coach knows their training. The summary is derived
// server-side from buildCoachPayload via summarizeCoachPayload - no derivation
// is duplicated here. Everything on it is calculated by the app: no italic.
export function CoachContextCard({ summary }: Props) {
  const t = useTranslations('coach.context');
  const exerciseName = useExerciseName();
  const id = useId();

  const goals = summary.goals.map((g) =>
    [
      t('goal', { name: exerciseName(g.exerciseName), weight: g.targetWeight, reps: g.targetReps }),
      g.achieved ? t('achieved') : t('goalProgress', { percent: g.progressPct }),
    ].join(' · '),
  );

  const rows: { label: string; value: React.ReactNode; empty?: boolean }[] = [
    {
      label: t('history'),
      ...(summary.weeksOfHistory > 0
        ? {
            value: t('historyValue', {
              weeks: summary.weeksOfHistory,
              exercises: summary.exercisesTracked,
            }),
          }
        : { value: t('noHistory'), empty: true }),
    },
    {
      label: t('goals'),
      ...(goals.length > 0
        ? {
            value: (
              <ul>
                {goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            ),
          }
        : { value: t('noGoals'), empty: true }),
    },
    {
      label: t('stalled'),
      ...(summary.stalledExercises.length > 0
        ? { value: summary.stalledExercises.map(exerciseName).join(', ') }
        : { value: t('noStalled'), empty: true }),
    },
    {
      label: t('deload'),
      ...(summary.deloadActive
        ? { value: t('deloadActive') }
        : summary.deloadRecommended
          ? {
              value: t('deloadRecommended', {
                reasons:
                  summary.deloadReasons.length > 0 ? summary.deloadReasons.join('; ') : 'none',
              }),
            }
          : { value: t('noDeload'), empty: true }),
    },
    {
      label: t('conditioning'),
      value: t('conditioningValue', {
        minutes: summary.conditioning.currentMinutes,
        km: summary.conditioning.currentKm > 0 ? summary.conditioning.currentKm : 'none',
        sessions: summary.conditioning.currentSessions,
        target: summary.conditioning.weeklyTargetMin,
      }),
    },
    {
      label: t('readiness'),
      ...(summary.readiness
        ? {
            value: t('readinessValue', {
              when:
                summary.readiness.daysAgo === 0
                  ? t('today')
                  : t('daysAgo', { days: summary.readiness.daysAgo }),
              readiness: summary.readiness.readiness,
              sleep: summary.readiness.sleepQuality,
            }),
          }
        : { value: t('noReadiness'), empty: true }),
    },
  ];

  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h2 id={id} className="mb-1 text-subtitle">
        {t('title')}
      </h2>
      <p className="mb-2.5 text-[0.8125rem] font-medium leading-[1.4] text-muted-foreground">
        {t('description')}
      </p>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between gap-3 border-t border-border py-2.5 text-[0.9375rem] font-medium"
          >
            <dt className="shrink-0">{row.label}</dt>
            <dd
              className={
                row.empty ? 'text-right text-muted-foreground' : 'text-right font-semibold'
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
