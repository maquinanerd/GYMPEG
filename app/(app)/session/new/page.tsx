import Link from 'next/link';
import { CaretLeftIcon } from '@/components/ui/icon';
import { getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/nav/screen-header';
import { ReadinessCheckin } from '@/components/session/readiness-checkin';
import { WorkoutStartList } from '@/components/session/workout-start-list';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { suggestNextWorkout } from '@/lib/next-workout-query';

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export default async function NewSessionPage() {
  const t = await getTranslations('session');
  const common = await getTranslations('common');
  const locale = await getLocale();
  const session = await requireSession();
  const [activeProgram, user, gyms] = await Promise.all([
    db.program.findFirst({
      where: { userId: session.userId, isActive: true },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { exercises: true } },
          },
        },
      },
    }),
    db.user.findUnique({ where: { id: session.userId }, select: { activeGymId: true } }),
    db.gym.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  const suggestion = activeProgram ? await suggestNextWorkout(session.userId, activeProgram) : null;

  // Picking a workout to start ("Trocar treino" on the home): the program's
  // workouts as rows in program order; the suggested one stands out by its
  // tag and ink button, not by moving to the top.
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-7">
      <div className="px-5 pt-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3 h-11">
          <Link href="/">
            <CaretLeftIcon weight="bold" />
            {common('actions.back')}
          </Link>
        </Button>
      </div>
      <ScreenHeader
        className="pt-1"
        title={t('startTitle')}
        subtitle={
          activeProgram
            ? t('activeProgram', { name: getTrainingDisplayName(activeProgram.name, locale) })
            : undefined
        }
      />

      <div className="flex flex-col gap-5 px-5 pt-3">
        {!activeProgram ? (
          <EmptyState
            title={t('noActiveProgram')}
            description={t('noActiveProgramDescription')}
            action={{ label: t('viewPrograms'), href: '/programs' }}
          />
        ) : activeProgram.workouts.length === 0 ? (
          <EmptyState
            title={t('noSession')}
            description={t('noSessionDescription')}
            action={{ label: t('configureProgram'), href: `/programs/${activeProgram.id}` }}
          />
        ) : (
          <>
            <ReadinessCheckin />
            <WorkoutStartList
              activeGymId={user?.activeGymId ?? null}
              gyms={gyms}
              suggestedId={suggestion?.workoutId ?? null}
              workouts={activeProgram.workouts.map((w) => {
                const dayKey = w.dayOfWeek != null ? DAY_KEYS[w.dayOfWeek - 1] : null;
                const day = dayKey ? common(`days.${dayKey}`) : null;
                return {
                  id: w.id,
                  name: getTrainingDisplayName(w.name, locale),
                  day,
                  exerciseCount: w._count.exercises,
                };
              })}
            />
          </>
        )}
      </div>
    </main>
  );
}
