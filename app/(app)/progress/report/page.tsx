import Link from 'next/link';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { formatWeight } from '@/lib/units';
import { loadWeeklyReport, parseWeekKey } from '@/lib/weekly-report';

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
  const kg = (value: number) => formatWeight(value, unit, { decimals: 1, locale });
  const day = (date: Date) => format.dateTime(date, { day: '2-digit', month: 'short', timeZone });
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const signedPct = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}%`;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="size-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('range', { start: day(weekStart), end: day(weekEnd) })}
            </p>
          </div>
        </div>

        <nav className="flex items-center justify-between gap-2" aria-label={t('navigation')}>
          <Button asChild variant="outline" size="sm">
            <Link href={`/progress/report?week=${previousWeekKey}`}>
              <ChevronLeft className="size-4" />
              {t('previous')}
            </Link>
          </Button>
          {nextWeekKey && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/progress/report?week=${nextWeekKey}`}>
                {t('next')}
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          )}
        </nav>

        {report.workingSets === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <>
            <Card data-testid="weekly-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('summary')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <p>
                  {report.sessions.planned != null
                    ? t('sessions', {
                        done: report.sessions.done,
                        planned: report.sessions.planned,
                      })
                    : t('sessionsDone', { done: report.sessions.done })}
                </p>
                <p>{t('sets', { effective: report.effectiveSets, working: report.workingSets })}</p>
                <p>{t('records', { count: report.records })}</p>
                <p>{t('tonnage', { weight: kg(report.tonnageKg) })}</p>
              </CardContent>
            </Card>

            <Card data-testid="weekly-muscles">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('muscles')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {report.muscles.map((muscle) => (
                    <li key={muscle.group} className="flex items-center justify-between gap-3">
                      <span>
                        {exercisesT(`muscleGroups.${muscleGroupMessageKeys[muscle.group]}`)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {t('muscleSets', { sets: format.number(muscle.effectiveSets) })}{' '}
                        <span className="font-medium text-foreground">
                          {muscle.changePct == null ? t('newMuscle') : signedPct(muscle.changePct)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {(report.bestProgress || report.bodyweight) && (
              <Card>
                <CardContent className="flex flex-col gap-1 p-4 text-sm">
                  {report.bestProgress && (
                    <p data-testid="weekly-best-progress">
                      {t('bestProgress', {
                        exercise: getExerciseDisplayName(report.bestProgress.exerciseName, locale),
                        from: kg(report.bestProgress.fromKg),
                        to: kg(report.bestProgress.toKg),
                      })}
                    </p>
                  )}
                  {report.bodyweight &&
                    (report.bodyweight.previousAverageKg != null ? (
                      <p>
                        {t('bodyweight', {
                          from: kg(report.bodyweight.previousAverageKg),
                          to: kg(report.bodyweight.averageKg),
                        })}
                      </p>
                    ) : (
                      <p>{t('bodyweightOnly', { weight: kg(report.bodyweight.averageKg) })}</p>
                    ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          {t('footer', { version: report.guidelineVersion })}
        </p>
      </div>
    </main>
  );
}
