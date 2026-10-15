import { getLocale, getTimeZone, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { EmptyState } from '@/components/ui/empty-state';
import { applyBodyweight, totalVolume } from '@/lib/stats';
import { formatWeight } from '@/lib/units';
import { formatDistance, formatDuration } from '@/lib/cardio';
import { HistoryCsvLink, HistoryFilters } from '@/components/history/history-filters';
import { TrainingHeader } from '@/components/nav/screen-header';
import {
  HistoryCalendar,
  type HistoryCalendarSession,
  type HistoryPlannedDays,
} from '@/components/history/history-calendar';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { getTrainingDisplayName } from '@/i18n/training-names';
import {
  dateKeyInTimeZone,
  formatMonthKey,
  getMonthQueryRange,
  parseMonthKey,
  resolveCalendarTimeZone,
} from '@/lib/history-calendar';
import {
  hasHistoryFilters,
  historySessionWhere,
  parseHistoryFilters,
} from '@/lib/history-filters';

interface SearchParams {
  programId?: string;
  gymId?: string;
  exerciseId?: string;
  muscle?: string;
  month?: string;
  day?: string;
  tz?: string;
}

export default async function HistoryPage(props: { searchParams: Promise<SearchParams> }) {
  const t = await getTranslations('history');
  const locale = await getLocale();
  const searchParams = await props.searchParams;
  const timeZone = resolveCalendarTimeZone(searchParams.tz, await getTimeZone());
  const auth = await requireSession();
  const month = parseMonthKey(searchParams.month, new Date(), timeZone);
  const monthKey = formatMonthKey(month);
  const monthRange = getMonthQueryRange(month);
  const filters = parseHistoryFilters(searchParams);

  const [sessions, programs, user, totalHistoryCount, gyms, trainedExercises, activeProgram] =
    await Promise.all([
      db.session.findMany({
        where: historySessionWhere(auth.userId, filters, monthRange),
        orderBy: { startedAt: 'asc' },
        include: {
          workout: { select: { name: true } },
          program: { select: { name: true } },
          sets: {
            select: {
              weight: true,
              reps: true,
              isWarmup: true,
              durationSec: true,
              distanceM: true,
              avgHr: true,
              exercise: { select: { usesBodyweight: true, name: true, category: true } },
            },
          },
        },
      }),
      db.program.findMany({
        where: { userId: auth.userId },
        orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
        select: { id: true, name: true },
      }),
      db.user.findUnique({
        where: { id: auth.userId },
        select: { bodyweight: true, unit: true },
      }),
      db.session.count({
        where: { userId: auth.userId, finishedAt: { not: null } },
      }),
      db.gym.findMany({
        where: { userId: auth.userId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      // Only exercises (and so muscles) that appear in the finished history.
      db.exercise.findMany({
        where: {
          sets: {
            some: { isWarmup: false, session: { userId: auth.userId, finishedAt: { not: null } } },
          },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, muscleGroup: true },
      }),
      // The active program's weekdays mark the planned days that were missed.
      db.program.findFirst({
        where: { userId: auth.userId, isActive: true },
        select: { scheduleMode: true, startDate: true, workouts: { select: { dayOfWeek: true } } },
      }),
    ]);

  const unit = user?.unit ?? 'KG';
  const calendarSessions: HistoryCalendarSession[] = sessions.map((session) => {
    const enrichedSets = applyBodyweight(
      session.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        isWarmup: set.isWarmup,
        durationSec: set.durationSec,
        usesBodyweight: set.exercise.usesBodyweight,
      })),
      user?.bodyweight,
    );
    const working = session.sets.filter((set) => !set.isWarmup);
    const cardioSets = working.filter(
      (set) => set.exercise.category === 'CARDIO' && set.durationSec != null,
    );
    const isCardio = working.length > 0 && cardioSets.length === working.length;
    const cardioDistance = cardioSets.reduce((sum, set) => sum + (set.distanceM ?? 0), 0);
    const cardioDurationSec = cardioSets.reduce((sum, set) => sum + (set.durationSec ?? 0), 0);
    const cardioAvgHr = cardioSets.find((set) => set.avgHr != null)?.avgHr ?? null;
    const durationMin = session.finishedAt
      ? Math.round((session.finishedAt.getTime() - session.startedAt.getTime()) / 60000)
      : null;
    const cardioName = cardioSets[0]?.exercise.name
      ? getExerciseDisplayName(cardioSets[0].exercise.name, locale)
      : t('cardio');

    return {
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      title: session.workout?.name
        ? getTrainingDisplayName(session.workout.name, locale)
        : isCardio
          ? cardioName
          : t('freeSession'),
      programName: session.program?.name
        ? getTrainingDisplayName(session.program.name, locale)
        : null,
      workingSets: working.length,
      // The list's value column: the tonnage alone ("8.410 kg").
      volumeLabel: isCardio
        ? null
        : formatWeight(totalVolume(enrichedSets), unit, { decimals: 0, locale }),
      durationLabel: !isCardio && durationMin != null ? t('minutes', { count: durationMin }) : null,
      cardioDistanceLabel: isCardio && cardioDistance > 0 ? formatDistance(cardioDistance) : null,
      cardioDurationLabel:
        isCardio && (cardioDurationSec > 0 || durationMin != null)
          ? formatDuration(cardioDurationSec || (durationMin ?? 0) * 60)
          : null,
      cardioHeartRateLabel: isCardio && cardioAvgHr != null ? `${cardioAvgHr} bpm` : null,
    };
  });

  // Same rule as the home week strip (lib/home-week): only a fixed-days
  // program has weekdays to miss. Filters hide sessions, so they turn it off.
  const plannedWeekdays =
    activeProgram?.scheduleMode === 'FIXED_DAYS'
      ? [
          ...new Set(
            activeProgram.workouts
              .map((workout) => workout.dayOfWeek)
              .filter((day): day is number => day != null),
          ),
        ]
      : [];
  const planned: HistoryPlannedDays | null =
    activeProgram && plannedWeekdays.length > 0 && !hasHistoryFilters(filters)
      ? { weekdays: plannedWeekdays, since: dateKeyInTimeZone(activeProgram.startDate, timeZone) }
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <TrainingHeader
        action={totalHistoryCount > 0 ? <HistoryCsvLink filters={filters} /> : undefined}
      />
      <div className="flex flex-col gap-5 px-5 pb-7 pt-4">
        {totalHistoryCount === 0 ? (
          <EmptyState
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={{ label: t('startWorkout'), href: '/session/new' }}
          />
        ) : (
          <HistoryCalendar
            monthKey={monthKey}
            initialDay={searchParams.day}
            sessions={calendarSessions}
            filters={filters}
            timeZone={timeZone}
            planned={planned}
            filtersSlot={
              <HistoryFilters
                programs={programs}
                gyms={gyms}
                exercises={trainedExercises.map((exercise) => ({
                  id: exercise.id,
                  name: getExerciseDisplayName(exercise.name, locale),
                }))}
                muscles={[...new Set(trainedExercises.map((exercise) => exercise.muscleGroup))]}
                filters={filters}
                selectedMonth={monthKey}
              />
            }
          />
        )}
      </div>
    </main>
  );
}
