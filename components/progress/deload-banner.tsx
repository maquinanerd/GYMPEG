'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { DeloadReason } from '@/lib/deload';
import { useExerciseName } from '@/components/shared/use-exercise-name';

interface Props {
  reasons: DeloadReason[];
  // End of the active planned deload week (ISO string), or null when none is
  // running. The server only passes a future timestamp here.
  deloadUntil: string | null;
}

// Deload note on the Treino tab when recommendDeload fires or a planned
// deload week is running (issue #112). One tap starts the deload week (the
// suggestion engine then steps loads down ~10%); while active it shows the end
// date and lets the user end it early.
export function DeloadBanner({ reasons, deloadUntil }: Props) {
  const t = useTranslations('progress.deload');
  const format = useFormatter();
  const exerciseName = useExerciseName();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const headingId = useId();
  const active = deloadUntil != null;

  if (!active && reasons.length === 0) return null;

  async function startDeload() {
    setBusy(true);
    try {
      const res = await fetch('/api/deload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Started from the recommendation: keep what it said (epic 2.5).
        body: JSON.stringify({
          trigger: 'RECOMMENDED',
          reasons: reasons.map((reason) => reason.kind),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('startError'));
        return;
      }
      toast.success(t('started'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function endDeload() {
    setBusy(true);
    try {
      const res = await fetch('/api/deload', { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('endError'));
        return;
      }
      toast.success(t('ended'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (active) {
    const endDate = format.dateTime(new Date(deloadUntil!), {
      day: '2-digit',
      month: 'short',
    });
    return (
      <section aria-labelledby={headingId} className={NOTE}>
        <h2 id={headingId} className="text-[0.8125rem] font-semibold">
          {t('activeTitle')}
        </h2>
        <p className="text-[0.9375rem] font-medium leading-[1.4]">
          {t('activeDescription', { date: endDate })}
        </p>
        <Button variant="ink" size="sm" className="mt-2 self-start" onClick={endDeload} loading={busy}>
          {t('end')}
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className={NOTE}>
      <h2 id={headingId} className="text-[0.8125rem] font-semibold">
        {t('dueTitle')}
      </h2>
      <ul className="flex flex-col gap-1 text-[0.9375rem] font-medium leading-[1.4]">
        {reasons.map((reason) => (
          <li key={reason.kind}>
            {reason.kind === 'stalled-lifts'
              ? t('stalledReason', {
                  count: reason.exerciseNames.length,
                  names: reason.exerciseNames.map(exerciseName).join(', '),
                })
              : reason.kind === 'low-readiness'
                ? t('readinessReason', {
                    average: reason.averageReadiness,
                    checkins: reason.checkins,
                  })
                : t('longBlockReason', { weeks: reason.weeks })}
          </li>
        ))}
      </ul>
      <p className="text-[0.8125rem] font-medium leading-[1.4]">{t('dueDescription')}</p>
      <Button variant="ink" size="sm" className="mt-2 self-start" onClick={startDeload} loading={busy}>
        {t('start')}
      </Button>
    </section>
  );
}

// The deload note: the deload accent as a fill (radius 12) with #111 text.
const NOTE =
  'flex flex-col gap-1 rounded-md bg-deload px-4 py-3.5 text-deload-foreground';
