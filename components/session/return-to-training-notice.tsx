'use client';

import { ArrowCounterClockwiseIcon } from '@/components/ui/icon';
import { useLocale, useTranslations } from 'next-intl';
import type { WeightUnit } from '@/lib/prisma-client';
import type { ReturnRecommendation } from '@/lib/return-to-training';
import { formatWeight } from '@/lib/units';

interface Props {
  recommendation: ReturnRecommendation | null | undefined;
  unit: WeightUnit;
  usesBodyweight: boolean;
}

export function ReturnToTrainingNotice({ recommendation, unit, usesBodyweight }: Props) {
  const t = useTranslations('session.returnToTraining');
  const locale = useLocale();
  if (!recommendation || recommendation.mode === 'normal') return null;

  const preservedPriorGap =
    recommendation.mode === 'exercise-reintro' &&
    recommendation.returnGapDays != null &&
    recommendation.exerciseGapDays != null &&
    recommendation.returnGapDays > recommendation.exerciseGapDays;
  const description =
    recommendation.mode === 'exercise-reintro'
      ? preservedPriorGap
        ? t('recentReturnAfterGap', { days: recommendation.returnGapDays! })
        : t('exerciseReintro', {
            days: recommendation.returnGapDays ?? recommendation.exerciseGapDays ?? 42,
          })
      : t('muscleReintro');

  return (
    <section
      data-testid="return-to-training-notice"
      className="rounded-md border border-warning/50 bg-warning/10 px-3 py-3 text-foreground"
    >
      <div className="flex items-start gap-2.5">
        <ArrowCounterClockwiseIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1 text-xs leading-relaxed sm:text-sm">
          <p className="font-semibold">{t('title')}</p>
          <p>{description}</p>
          <p className="font-medium">
            {t('targets', {
              sets: recommendation.targetSets,
              rir: recommendation.targetRIR,
            })}
          </p>
          {recommendation.suggestedWeight != null ? (
            <p>
              {usesBodyweight && recommendation.suggestedWeight === 0
                ? t('bodyweightStart')
                : t('startWeight', {
                    weight: formatWeight(recommendation.suggestedWeight, unit, {
                      decimals: 2,
                      locale,
                    }),
                  })}
            </p>
          ) : (
            <p>{t('chooseLoad')}</p>
          )}
          {recommendation.weightCeiling != null && recommendation.weightCeiling > 0 && (
            <p>
              {t('ceiling', {
                weight: formatWeight(recommendation.weightCeiling, unit, {
                  decimals: 2,
                  locale,
                }),
              })}
            </p>
          )}
          <p>{t('calibrate')}</p>
        </div>
      </div>
    </section>
  );
}
