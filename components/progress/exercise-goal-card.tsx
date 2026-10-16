'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { WeightUnit } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Section } from '@/components/ui/section';
import { Tag } from '@/components/ui/tag';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { goalProgress, goalTargetE1RM } from '@/lib/goals';
import { formatWeight, fromDisplayWeight, roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';

// One active goal per exercise, as served by the goals API. achievedAt is
// serialized to an ISO string by the Server Component boundary.
export interface GoalView {
  id: string;
  targetWeight: number; // kg (effective load for bodyweight exercises)
  targetReps: number;
  achievedAt: string | null;
}

interface Props {
  exerciseId: string;
  exerciseName: string;
  usesBodyweight: boolean;
  goal: GoalView | null;
  // Best e1RM ever logged for this exercise (kg, bodyweight-adjusted).
  bestE1RM: number;
  unit: WeightUnit;
}

export function ExerciseGoalCard({
  exerciseId,
  exerciseName,
  usesBodyweight,
  goal,
  bestE1RM,
  unit,
}: Props) {
  const t = useTranslations('progress.goal');
  const common = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Dialog fields, kept in the display unit like every weight input.
  const [weightField, setWeightField] = useState('');
  const [repsField, setRepsField] = useState('');

  const target = goal
    ? { targetWeight: goal.targetWeight, targetReps: goal.targetReps }
    : null;
  const progress = target ? goalProgress(bestE1RM, target) : 0;
  const achieved = goal?.achievedAt != null;

  function openDialog() {
    setWeightField(
      goal ? String(roundWeight(toDisplayWeight(goal.targetWeight, unit), 1)) : '',
    );
    setRepsField(goal ? String(goal.targetReps) : '');
    setOpen(true);
  }

  async function saveGoal() {
    const weight = parseFloat(weightField);
    const reps = parseInt(repsField, 10);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1) {
      toast.error(t('invalid'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId,
          targetWeight: fromDisplayWeight(weight, unit),
          targetReps: reps,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('saveError'));
        return;
      }
      toast.success(t('saved'));
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal() {
    if (!goal) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? t('removeError'));
        return;
      }
      toast.success(t('removed'));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const percent = Math.round(progress * 100);

  return (
    <Section
      size="sm"
      divider
      title={t('title', { exercise: exerciseName })}
      action={
        goal && target ? (
          <Num stretch={112} className="text-caption">
            {percent}%
          </Num>
        ) : undefined
      }
    >
      {!goal || !target ? (
        <p className="text-caption text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <ProgressBar size="md" value={percent} max={100} label={t('progressAria')} />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-caption font-semibold">
                {t('target', {
                  weight: formatWeight(goal.targetWeight, unit, { locale }),
                  reps: goal.targetReps,
                })}
              </span>
              {achieved && <Tag variant="primary">{t('achieved')}</Tag>}
            </div>
            <p className="text-[0.8125rem] font-medium text-muted-foreground">
              {t('progress', {
                percent,
                best: formatWeight(bestE1RM, unit, { locale }),
                target: formatWeight(goalTargetE1RM(target), unit, { locale }),
              })}
            </p>
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={openDialog}>
          {goal ? t('edit') : t('set')}
        </Button>
        {goal && (
          <Button type="button" variant="ghost" size="sm" onClick={removeGoal} disabled={busy}>
            {t('remove')}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-heading">
              {goal ? t('edit') : t('set')} · {exerciseName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-weight">{t('targetLoad', { unit: unitLabel(unit) })}</Label>
              <Input
                id="goal-weight"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={weightField}
                onChange={(e) => setWeightField(e.target.value)}
              />
              {usesBodyweight && (
                <p className="text-small text-muted-foreground">{t('bodyweightHelp')}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-reps">{t('targetReps')}</Label>
              <Input
                id="goal-reps"
                type="number"
                inputMode="numeric"
                min="1"
                value={repsField}
                onChange={(e) => setRepsField(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {common('actions.cancel')}
            </Button>
            <Button type="button" variant="ink" onClick={saveGoal} loading={busy}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
