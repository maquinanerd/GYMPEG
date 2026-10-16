'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FireIcon } from '@/components/ui/icon';
import type { WeightUnit } from '@/lib/prisma-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import { computeWarmupRamp } from '@/lib/warmup';
import { plateConfigForUnit } from '@/lib/preferences';
import { roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';

interface Props {
  // The current working load, stored in kg (the app's storage unit).
  weightKg: number;
  unit: WeightUnit;
  barWeightsKg?: number[];
}

// In-workout warm-up ramp calculator (issue #69). Given the working weight, it
// suggests a short ramp of warm-up sets at ascending percentages with
// descending reps, in the user's display unit and rounded to loadable plates.
// Display-only; it never creates or mutates a set (mirrors the plate calculator).
export function WarmupCalculator({ weightKg, unit, barWeightsKg }: Props) {
  const t = useTranslations('session.calculator');
  const [open, setOpen] = useState(false);

  // Compute lazily when the dialog opens so the bar weight is only read from
  // localStorage on the client, and only when the user wants the calculator.
  const ramp = useMemo(() => {
    if (!open) return null;
    const fallback = plateConfigForUnit(unit);
    const barWeight = barWeightsKg?.length
      ? Math.min(...barWeightsKg.map((weight) => roundWeight(toDisplayWeight(weight, unit), 2)))
      : fallback.barWeight;
    const working = roundWeight(toDisplayWeight(weightKg, unit), 2);
    return computeWarmupRamp(working, unit, barWeight);
  }, [barWeightsKg, open, weightKg, unit]);

  const label = unitLabel(unit);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2.5 text-muted-foreground"
          aria-label={t('openWarmup')}
        >
          <FireIcon className="size-4" />
          {t('warmupButton')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('warmup')}</DialogTitle>
          <DialogDescription>
            {t('warmupDescription', {
              weight: ramp ? `${ramp.workingWeight} ${label}` : t('currentWeight'),
            })}
          </DialogDescription>
        </DialogHeader>

        {ramp && (
          <div className="flex flex-col gap-4">
            {ramp.sets.length > 0 ? (
              <ol className="border-b border-border" aria-label={t('warmupSets')}>
                {ramp.sets.map((set, index) => (
                  <li
                    key={`${set.weight}-${index}`}
                    className="flex min-h-12 items-center justify-between gap-2 border-t border-border"
                  >
                    <span className="flex items-baseline gap-2">
                      <Num stretch={118} className="text-subtitle">
                        {set.weight} {label}
                      </Num>
                      <span className="text-small text-muted-foreground">{set.percent}%</span>
                    </span>
                    <Num stretch={112} className="text-caption">
                      {t('reps', { count: set.reps })}
                    </Num>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-caption text-muted-foreground">{t('noWarmup')}</p>
            )}

            <p className="text-small text-muted-foreground">{t('warmupHelp')}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
