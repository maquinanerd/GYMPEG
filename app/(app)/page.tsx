import { getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getHomeInsight } from '@/lib/home-insight';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { suggestNextWorkout } from '@/lib/next-workout-query';
import { cycleWeekAt, isDeloadWeek, programCycle } from '@/lib/program-cycle';
import { getUserTimeZone } from '@/lib/user-timezone';
import { recentPersonalRecords } from '@/lib/personal-records';
import { weeklyAdherence } from '@/lib/adherence';
import { isoWeekStart } from '@/lib/stats';
import { compactMuscles } from '@/lib/muscle-map';
import { calculateWeightTrend } from '@/lib/training-engine/body';
import {
  buildWeekStrip,
  estimateWorkoutMinutes,
  greetingName,
  greetingPeriod,
  weekDayStatus,
} from '@/lib/home-week';
import { HomeView, type HomeExercise, type HomeNext } from '@/components/home/home-view';

const RECENT_RECORDS_DAYS = 30;
const RECENT_RECORDS_SHOWN = 3;
// The weekly weight rate looks at the last 30 days (lib/training-engine/body).
const WEIGHT_LOOKBACK_DAYS = 35;
const DAY_MS = 86_400_000;

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
  const locale = await getLocale();
  const session = await requireSession();
  const now = new Date();
  const timeZone = await getUserTimeZone(session.userId);
  const weekStart = isoWeekStart(now, timeZone);

  const [profile, inProgressSession, activeProgram, weekSessions] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: {
        displayName: true,
        onboardedAt: true,
        unit: true,
        weeklyFrequency: true,
        deloadUntil: true,
      },
    }),
    // An unfinished session is offered for resuming.
    db.session.findFirst({
      where: { userId: session.userId, finishedAt: null },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        startedAt: true,
        workout: {
          select: {
            name: true,
            exercises: {
              orderBy: { order: 'asc' },
              select: {
                targetSets: true,
                targetRepsMin: true,
                targetRepsMax: true,
                exercise: { select: { name: true, muscleGroup: true } },
              },
            },
          },
        },
        _count: { select: { sets: { where: { isWarmup: false } } } },
      },
    }),
    db.program.findFirst({
      where: { userId: session.userId, isActive: true },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { exercises: true } },
            exercises: {
              orderBy: { order: 'asc' },
              select: {
                targetSets: true,
                targetRepsMin: true,
                targetRepsMax: true,
                restSec: true,
                exercise: { select: { name: true, muscleGroup: true } },
              },
            },
          },
        },
      },
    }),
    // Finished sessions of this week, for the week strip and the counts.
    db.session.findMany({
      where: { userId: session.userId, finishedAt: { not: null }, startedAt: { gte: weekStart } },
      select: {
        startedAt: true,
        _count: { select: { sets: { where: { isWarmup: false } } } },
      },
    }),
  ]);

  // Proactive insight (issue #237): the single highest-priority deterministic
  // signal (deload / stalled lift / fresh PR / on track). No LLM call.
  const [insight, records, weighIns, adherence, next] = await Promise.all([
    getHomeInsight(session.userId, now, locale),
    recentPersonalRecords(
      session.userId,
      new Date(now.getTime() - RECENT_RECORDS_DAYS * DAY_MS),
      RECENT_RECORDS_SHOWN,
    ),
    db.bodyweightEntry.findMany({
      where: {
        userId: session.userId,
        measuredAt: { gte: new Date(now.getTime() - WEIGHT_LOOKBACK_DAYS * DAY_MS) },
      },
      orderBy: { measuredAt: 'desc' },
      select: { weightKg: true, measuredAt: true },
    }),
    // This week against the plan (epic 2.3).
    activeProgram && activeProgram.workouts.length > 0
      ? weeklyAdherence(session.userId, activeProgram, {
          now,
          timeZone,
          weeklyFrequency: profile?.weeklyFrequency ?? null,
        })
      : null,
    // The next workout of the program (rotation or fixed days, epic 1.6).
    !inProgressSession && activeProgram
      ? suggestNextWorkout(session.userId, activeProgram, now)
      : null,
  ]);

  // The prescription of each exercise, in program order, for the lime block.
  const toHomeExercises = (
    rows: {
      targetSets: number;
      targetRepsMin: number;
      targetRepsMax: number;
      exercise: { name: string };
    }[],
  ): HomeExercise[] =>
    rows.map((row) => ({
      name: getExerciseDisplayName(row.exercise.name, locale),
      sets: row.targetSets,
      repsMin: row.targetRepsMin,
      repsMax: row.targetRepsMax,
    }));

  // The dominant block, in priority order: a workout in progress, a brand-new
  // account, no program, an empty program, the next workout, a free choice.
  let homeNext: HomeNext;
  if (inProgressSession) {
    const rows = inProgressSession.workout?.exercises ?? [];
    homeNext = {
      kind: 'inProgress',
      sessionId: inProgressSession.id,
      title: inProgressSession.workout?.name
        ? getTrainingDisplayName(inProgressSession.workout.name, locale)
        : t('sessionFallback'),
      elapsedMinutes: Math.max(
        0,
        Math.floor((now.getTime() - inProgressSession.startedAt.getTime()) / 60_000),
      ),
      setsDone: inProgressSession._count.sets,
      setsTotal: rows.reduce((sum, row) => sum + row.targetSets, 0),
      muscles: compactMuscles(rows.map((row) => row.exercise.muscleGroup)),
      exercises: toHomeExercises(rows),
    };
  } else if (!activeProgram) {
    homeNext = profile && !profile.onboardedAt ? { kind: 'new' } : { kind: 'noProgram' };
  } else if (activeProgram.workouts.length === 0) {
    homeNext = {
      kind: 'empty',
      programId: activeProgram.id,
      programName: getTrainingDisplayName(activeProgram.name, locale),
      reason: t('emptyProgramDescription', {
        name: getTrainingDisplayName(activeProgram.name, locale),
      }),
    };
  } else {
    const nextWorkout = next
      ? (activeProgram.workouts.find((workout) => workout.id === next.workoutId) ?? null)
      : null;
    if (!next || !nextWorkout) {
      homeNext = {
        kind: 'choose',
        programName: getTrainingDisplayName(activeProgram.name, locale),
      };
    } else {
      const lastWorkoutName =
        next.kind === 'rotation' && next.afterWorkoutId
          ? activeProgram.workouts.find((workout) => workout.id === next.afterWorkoutId)?.name
          : undefined;
      const reason =
        next.kind === 'today'
          ? t('nextToday')
          : next.kind === 'upcoming'
            ? t('nextUpcoming', {
                day: common(`days.${DAY_KEYS[next.dayOfWeek - 1]!}`),
                count: next.inDays,
              })
            : lastWorkoutName
              ? t('nextAfter', { name: getTrainingDisplayName(lastWorkoutName, locale) })
              : t('nextFirst');
      // Week of the program's cycle, and whether this week (or a planned
      // deload the lifter started) runs lighter.
      const cycle = programCycle(activeProgram);
      const cycleWeek = cycle ? cycleWeekAt(cycle, now, timeZone) : null;
      const weekText =
        cycle && cycleWeek ? t('cycleWeek', { week: cycleWeek, weeks: cycle.weeks }) : null;
      const deload =
        (cycle != null && cycleWeek != null && isDeloadWeek(cycle, cycleWeek)) ||
        (profile?.deloadUntil != null && profile.deloadUntil > now);
      homeNext = {
        kind: 'next',
        workoutId: nextWorkout.id,
        title: getTrainingDisplayName(nextWorkout.name, locale),
        // Cycle week ("Semana 3 de 5"), else the program name.
        kicker: weekText ?? getTrainingDisplayName(activeProgram.name, locale),
        deload,
        scheduledToday: next.kind === 'today',
        minutes: estimateWorkoutMinutes(nextWorkout.exercises),
        reason,
        muscles: compactMuscles(nextWorkout.exercises.map((row) => row.exercise.muscleGroup)),
        exercises: toHomeExercises(nextWorkout.exercises),
      };
    }
  }

  const plannedWeekdays =
    activeProgram?.scheduleMode === 'FIXED_DAYS'
      ? activeProgram.workouts.flatMap((workout) =>
          workout.dayOfWeek != null ? [workout.dayOfWeek] : [],
        )
      : [];
  const week = buildWeekStrip({
    now,
    timeZone,
    trainedAt: weekSessions.map((row) => row.startedAt),
    plannedWeekdays,
  }).map((day) => ({
    key: day.key,
    date: day.date,
    status: weekDayStatus(day),
    trained: day.trained,
  }));

  const trend = weighIns.length > 0 ? calculateWeightTrend(weighIns, { timeZone }) : null;

  return (
    <HomeView
      data={{
        name: greetingName(profile?.displayName, session.email),
        greeting: greetingPeriod(now, timeZone),
        now,
        timeZone,
        unit: profile?.unit ?? 'KG',
        week,
        next: homeNext,
        weekStats:
          adherence && adherence.sessionsPlanned > 0
            ? {
                sessionsDone: adherence.sessionsDone,
                sessionsPlanned: adherence.sessionsPlanned,
                setsDone: adherence.setsDone,
                setsPrescribed: adherence.setsPrescribed > 0 ? adherence.setsPrescribed : null,
              }
            : {
                sessionsDone: weekSessions.length,
                sessionsPlanned: null,
                setsDone: weekSessions.reduce((sum, row) => sum + row._count.sets, 0),
                setsPrescribed: null,
              },
        insight,
        records: records.map((record) => ({
          id: record.id,
          type: record.type,
          exerciseName: record.exerciseName
            ? getExerciseDisplayName(record.exerciseName, locale)
            : null,
          value: record.value,
          previousValue: record.previousValue,
          weightKg: record.weightKg,
          achievedAt: record.achievedAt,
        })),
        weight:
          weighIns[0] && trend
            ? {
                latestKg: weighIns[0].weightKg,
                averageKg: trend.averageKg,
                ratePerWeekKg: trend.ratePerWeekKg,
                // The same weigh-ins, drawn as the sparkline.
                series: weighIns.map((entry) => ({ at: entry.measuredAt, kg: entry.weightKg })),
              }
            : null,
      }}
    />
  );
}
