import Link from 'next/link';
import { Dumbbell, Play, AlertCircle, Lightbulb, Sparkles } from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getHomeInsight } from '@/lib/home-insight';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { suggestNextWorkout } from '@/lib/next-workout-query';
import { cycleWeekAt, isDeloadWeek, programCycle } from '@/lib/program-cycle';
import { getUserTimeZone } from '@/lib/user-timezone';
import { StartWorkoutButton } from '@/components/session/start-workout-button';
import { RecentRecordsCard } from '@/components/progress/recent-records-card';
import { recentPersonalRecords } from '@/lib/personal-records';
import { weeklyAdherence } from '@/lib/adherence';
import { Progress } from '@/components/ui/progress';

const RECENT_RECORDS_DAYS = 30;

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const common = await getTranslations('common');
  const format = await getFormatter();
  const locale = await getLocale();
  const session = await requireSession();

  // Look for an unfinished session to offer resuming it.
  const inProgressSession = await db.session.findFirst({
    where: { userId: session.userId, finishedAt: null },
    orderBy: { startedAt: 'desc' },
    include: { workout: { select: { name: true } } },
  });

  const activeProgram = await db.program.findFirst({
    where: { userId: session.userId, isActive: true },
    include: {
      workouts: {
        orderBy: { order: 'asc' },
        include: { _count: { select: { exercises: true } } },
      },
    },
  });

  // Proactive coach insight (issue #237): the single highest-priority
  // deterministic signal (recommended deload / stalled lift / fresh PR /
  // on-track), composed from the existing derivations. Display-only, no LLM
  // call; null on a brand-new account with no history.
  const insight = await getHomeInsight(session.userId, new Date(), locale);

  // New accounts are invited (not forced) to set up their training profile.
  const profile = await db.user.findUnique({
    where: { id: session.userId },
    select: { onboardedAt: true, unit: true, weeklyFrequency: true },
  });

  // Records beaten in the last 30 days (epic 2.2), newest first.
  const recentRecords = await recentPersonalRecords(
    session.userId,
    new Date(Date.now() - RECENT_RECORDS_DAYS * 24 * 60 * 60 * 1000),
  );

  // The next workout of the program (rotation or fixed days, epic 1.6).
  const next =
    !inProgressSession && activeProgram
      ? await suggestNextWorkout(session.userId, activeProgram)
      : null;
  const nextWorkout = next
    ? (activeProgram?.workouts.find((workout) => workout.id === next.workoutId) ?? null)
    : null;
  const lastWorkoutName =
    next?.kind === 'rotation' && next.afterWorkoutId
      ? activeProgram?.workouts.find((workout) => workout.id === next.afterWorkoutId)?.name
      : undefined;
  const nextReason = !next
    ? null
    : next.kind === 'today'
      ? t('nextToday')
      : next.kind === 'upcoming'
        ? t('nextUpcoming', {
            day: common(`days.${DAY_KEYS[next.dayOfWeek - 1]!}`),
            count: next.inDays,
          })
        : lastWorkoutName
          ? t('nextAfter', { name: getTrainingDisplayName(lastWorkoutName, locale) })
          : t('nextFirst');
  // Week of the program's cycle, when it has one.
  const timeZone = await getUserTimeZone(session.userId);
  const cycle = activeProgram ? programCycle(activeProgram) : null;
  const cycleWeek = cycle ? cycleWeekAt(cycle, new Date(), timeZone) : null;
  // This week against the plan (epic 2.3).
  const adherence =
    activeProgram && activeProgram.workouts.length > 0
      ? await weeklyAdherence(session.userId, activeProgram, {
          now: new Date(),
          timeZone,
          weeklyFrequency: profile?.weeklyFrequency ?? null,
        })
      : null;
  const cycleLine =
    cycle && cycleWeek
      ? isDeloadWeek(cycle, cycleWeek)
        ? t('cycleDeload', { week: cycleWeek, weeks: cycle.weeks })
        : t('cycleWeek', { week: cycleWeek, weeks: cycle.weeks })
      : null;

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Dumbbell className="size-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GYM Peg</h1>
            <p className="text-xs text-muted-foreground">{session.email}</p>
          </div>
        </div>

        {profile && !profile.onboardedAt && (
          <Link href="/onboarding" className="block">
            <Card className="border-primary/40 bg-primary/5 transition-colors hover:bg-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  {t('onboardingTitle')}
                </CardTitle>
                <CardDescription>{t('onboardingDescription')}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        {insight && (
          <Link href={insight.href} className="block">
            <Card className="border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="size-4 text-primary" />
                  {insight.title}
                </CardTitle>
                <CardDescription>{insight.detail}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}

        <RecentRecordsCard records={recentRecords} unit={profile?.unit ?? 'KG'} />

        {inProgressSession ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('activeSession')}</CardTitle>
              <CardDescription>
                {t('startedOn', {
                  name: inProgressSession.workout?.name
                    ? getTrainingDisplayName(inProgressSession.workout.name, locale)
                    : t('sessionFallback'),
                  date: format.dateTime(inProgressSession.startedAt, {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="min-h-tap w-full text-base">
                <Link href={`/session/${inProgressSession.id}`}>{t('resumeSession')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : !activeProgram ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('noActiveProgram')}</CardTitle>
              <CardDescription>{t('noActiveProgramDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/programs">{t('viewPrograms')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : activeProgram.workouts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('emptyProgram')}</CardTitle>
              <CardDescription>
                {t('emptyProgramDescription', {
                  name: getTrainingDisplayName(activeProgram.name, locale),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/programs/${activeProgram.id}`}>{t('configureProgram')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {nextWorkout ? (
              <Card data-testid="next-workout">
                <CardHeader className="pb-3">
                  <CardDescription>{t('nextWorkout')}</CardDescription>
                  <CardTitle className="text-xl">
                    {getTrainingDisplayName(nextWorkout.name, locale)}
                  </CardTitle>
                  <CardDescription>
                    {nextReason} ·{' '}
                    {t('activeProgram', {
                      name: getTrainingDisplayName(activeProgram.name, locale),
                    })}
                  </CardDescription>
                  {cycleLine && (
                    <p data-testid="cycle-week" className="text-sm font-medium">
                      {cycleLine}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <StartWorkoutButton workoutId={nextWorkout.id} />
                  <Button asChild variant="ghost" className="min-h-tap">
                    <Link href="/session/new">{t('chooseOther')}</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('startSession')}</CardTitle>
                  <CardDescription>
                    {t('activeProgram', {
                      name: getTrainingDisplayName(activeProgram.name, locale),
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="min-h-tap w-full text-base">
                    <Link href="/session/new">
                      <Play className="size-5" />
                      <span className="ml-2">{t('chooseSession')}</span>
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {adherence && adherence.sessionsPlanned > 0 && (
              <Card data-testid="weekly-adherence">
                <CardContent className="flex flex-col gap-2 p-4">
                  <p className="text-sm font-medium">{t('adherence.title')}</p>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">
                      {t('adherence.sessions', {
                        done: adherence.sessionsDone,
                        planned: adherence.sessionsPlanned,
                      })}
                    </p>
                    <Progress
                      value={adherence.sessionRatio * 100}
                      aria-label={t('adherence.sessionsLabel')}
                    />
                  </div>
                  {adherence.setsPrescribed > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t('adherence.sets', {
                        done: adherence.setsDone,
                        prescribed: adherence.setsPrescribed,
                      })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('programSessions')}
              </h2>
              <ul className="flex flex-col gap-2">
                {activeProgram.workouts.map((w) => {
                  const dayKey = w.dayOfWeek != null ? DAY_KEYS[w.dayOfWeek - 1] : null;
                  const day = dayKey ? common(`days.${dayKey}`) : null;
                  const empty = w._count.exercises === 0;
                  return (
                    <li key={w.id}>
                      <Card>
                        <CardContent className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {getTrainingDisplayName(w.name, locale)}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {w.id === nextWorkout?.id && <Badge>{t('nextBadge')}</Badge>}
                              {day && <Badge variant="secondary">{day}</Badge>}
                              <span>
                                {common('counts.exercises', { count: w._count.exercises })}
                              </span>
                              {empty && (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <AlertCircle className="size-3" />
                                  {common('states.empty')}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
