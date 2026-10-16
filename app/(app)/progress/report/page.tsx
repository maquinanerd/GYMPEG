import Link from 'next/link';
import { CaretLeftIcon, CaretRightIcon } from '@/components/ui/icon';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ScreenHeader } from '@/components/nav/screen-header';
import { Button } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import { Section, textLinkClass } from '@/components/ui/section';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { formatWeight } from '@/lib/units';
import { loadWeeklyReport, parseWeekKey } from '@/lib/weekly-report';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<{ week?: string }>;
}

// Deterministic weekly report (epic 2.6): every number comes from the
// training engine (lib/training-engine/weekly-report), with the guideline
// version it was computed under.
export default async function WeeklyReportPage(props: Props) {
  const auth = await requireSession();
  const t = await getTranslations('progress.report');
  const exercisesT = await getTranslations('exercises');
  const locale = await getLocale();
  const format = await getFormatter();
  const { week } = await props.searchParams;

  const [{ report, weekStart, previousWeekKey, nextWeekKey, timeZone }, user] = await Promise.all([
    loadWeeklyReport(auth.userId, parseWeekKey(week)),
    db.user.findUnique({ where: { id: auth.userId }, select: { unit: true } }),
  ]);
  const unit = user?.unit ?? 'KG';
  const kg = (value: number, decimals = 1) => formatWeight(value, unit, { decimals, locale });
  const day = (date: Date) => format.dateTime(date, { day: '2-digit', month: 'short', timeZone });
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const signedPct = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}%`;

  const summary: { key: string; label: string; value: string; note?: string }[] = [
    {
      key: 'workouts',
      label: t('workouts'),
      value:
        report.sessions.planned != null
          ? t('workoutsPlanned', { done: report.sessions.done, planned: report.sessions.planned })
          : format.number(report.sessions.done),
    },
    {
      key: 'sets',
      label: t('effectiveSets'),
      value: format.number(report.effectiveSets),
      note: t('effectiveOf', { working: format.number(report.workingSets) }),
    },
    { key: 'records', label: t('records'), value: format.number(report.records) },
    { key: 'tonnage', label: t('tonnage'), value: kg(report.tonnageKg, 0) },
  ];

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl">
        <div className="px-5 pt-3">
          <Link
            href="/progress"
            className={cn(textLinkClass, 'inline-flex min-h-11 items-center gap-1')}
          >
            <CaretLeftIcon aria-hidden className="size-4" />
            {t('back')}
          </Link>
        </div>
        <ScreenHeader
          className="pt-1"
          title={t('title')}
          subtitle={t('range', { start: day(weekStart), end: day(weekEnd) })}
        />

        <div className="flex flex-col gap-6 px-5 pb-7 pt-3">
          {/* Two equal halves so both fit side by side at 320px. */}
          <nav className="grid grid-cols-2 gap-2" aria-label={t('navigation')}>
            <Button asChild variant="outline" size="sm" className="min-h-touch w-full px-3">
              <Link href={`/progress/report?week=${previousWeekKey}`}>
                <CaretLeftIcon aria-hidden />
                {t('previous')}
              </Link>
            </Button>
            {nextWeekKey && (
              <Button asChild variant="outline" size="sm" className="min-h-touch w-full px-3">
                <Link href={`/progress/report?week=${nextWeekKey}`}>
                  {t('next')}
                  <CaretRightIcon aria-hidden />
                </Link>
              </Button>
            )}
          </nav>

          {report.workingSets === 0 ? (
            <p className="text-caption text-muted-foreground">{t('empty')}</p>
          ) : (
            <>
              <Section size="sm" title={t('summary')} data-testid="weekly-summary">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
                  {summary.map((item) => (
                    <div key={item.key}>
                      <dt className="text-[0.8125rem] font-medium text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="mt-0.5 flex items-baseline gap-1.5">
                        <Num stretch={118} className="text-[1.625rem] leading-tight">
                          {item.value}
                        </Num>
                        {item.note && (
                          <span className="text-[0.8125rem] font-medium text-muted-foreground">
                            {item.note}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>

              <Section
                size="sm"
                divider
                title={t('muscles')}
                aside={t('musclesHint')}
                data-testid="weekly-muscles"
              >
                <ul>
                  {report.muscles.map((muscle) => (
                    <li
                      key={muscle.group}
                      className="flex min-h-11 items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
                    >
                      <span className="text-[0.9375rem] font-medium">
                        {exercisesT(`muscleGroups.${muscleGroupMessageKeys[muscle.group]}`)}
                      </span>
                      <span className="flex items-baseline gap-2.5">
                        <Num stretch={112} className="text-[0.9375rem]">
                          {t('muscleSets', { sets: muscle.effectiveSets })}
                        </Num>
                        <span
                          className={cn(
                            'min-w-12 text-right text-[0.8125rem] font-semibold',
                            muscle.changePct != null && muscle.changePct > 0
                              ? 'text-brand'
                              : 'text-muted-foreground',
                          )}
                        >
                          {muscle.changePct == null ? t('newMuscle') : signedPct(muscle.changePct)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              {(report.bestProgress || report.bodyweight) && (
                <Section size="sm" divider title={t('highlights')}>
                  <ul className="flex flex-col gap-1 text-[0.9375rem] font-medium leading-[1.5]">
                    {report.bestProgress && (
                      <li data-testid="weekly-best-progress">
                        {t('bestProgress', {
                          exercise: getExerciseDisplayName(report.bestProgress.exerciseName, locale),
                          from: kg(report.bestProgress.fromKg),
                          to: kg(report.bestProgress.toKg),
                        })}
                      </li>
                    )}
                    {report.bodyweight && (
                      <li>
                        {report.bodyweight.previousAverageKg != null
                          ? t('bodyweight', {
                              from: kg(report.bodyweight.previousAverageKg),
                              to: kg(report.bodyweight.averageKg),
                            })
                          : t('bodyweightOnly', { weight: kg(report.bodyweight.averageKg) })}
                      </li>
                    )}
                  </ul>
                </Section>
              )}
            </>
          )}

          <p className="text-small text-muted-foreground">
            {t('footer', { version: report.guidelineVersion })}
          </p>
        </div>
      </div>
    </main>
  );
}
