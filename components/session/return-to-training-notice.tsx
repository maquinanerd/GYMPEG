'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Tag } from '@/components/ui/tag';
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

  // A hairline block led by the warning tag: the state in words, then the
  // calibration targets (accents are fills, never tinted boxes).
  return (
    <section
      data-testid="return-to-training-notice"
      className="flex flex-col gap-2 border-t border-border pt-4 text-foreground"
    >
      <Tag variant="warning">{t('title')}</Tag>
      <div className="flex min-w-0 flex-col gap-1 text-caption leading-[1.45]">
        <p>{description}</p>
        <p className="font-semibold">
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
          <p className="text-muted-foreground">{t('calibrate')}</p>
      </div>
    </section>
  );
}
