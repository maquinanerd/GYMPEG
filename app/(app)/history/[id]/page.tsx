import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTimeZone, getTranslations } from 'next-intl/server';
import { CaretLeftIcon, DownloadSimpleIcon } from '@/components/ui/icon';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button, IconButton } from '@/components/ui/button';
import { Highlight } from '@/components/ui/highlight';
import { Num } from '@/components/ui/num';
import { Tag } from '@/components/ui/tag';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import { applyBodyweight, best1RM, totalVolume } from '@/lib/stats';
import {
  formatCardioSet,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  sumCardioWorkingSets,
} from '@/lib/cardio';
import { formatWeight } from '@/lib/units';
import { formatWorkoutText } from '@/lib/workout-text';
import { CopyWorkoutButton } from '@/components/history/copy-workout-button';
import { DeleteSessionButton } from '@/components/history/delete-session-button';
import { ActivityTrackChart } from '@/components/history/activity-track-chart';
import { TrackDecoupling } from '@/components/history/track-decoupling';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { resolveCalendarTimeZone } from '@/lib/history-calendar';
import {
  parseHistoryFilters,
  setHistoryFilterParams,
  type HistoryFilterKey,
} from '@/lib/history-filters';

type BackParams = Partial<Record<'month' | 'day' | 'tz' | HistoryFilterKey, string>>;

interface Params {
  params: Promise<{ id: string }>;
  searchParams: Promise<BackParams>;
}

// The calendar links here with the month, day, history filters and the
// lifter's zone; the back link returns to that exact view and the date line
// is formatted in that zone (review of #351).
function buildBackHref(params: BackParams) {
  const query = new URLSearchParams();
  for (const key of ['month', 'day'] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  setHistoryFilterParams(query, parseHistoryFilters(params));
  if (params.tz) query.set('tz', params.tz);
  const qs = query.toString();
  return qs ? `/history?${qs}` : '/history';
}

const TH = 'py-2 text-left text-small font-semibold text-muted-foreground';
const TD = 'py-2.5';

export default async function HistorySessionPage(props: Params) {
  const t = await getTranslations('history');
  const detail = await getTranslations('history.detail');
  const copyT = await getTranslations('history.copy');
  const exerciseT = await getTranslations('exercises');
  const common = await getTranslations('common');
  const locale = await getLocale();
  const format = await getFormatter();
  const params = await props.params;
  const searchParams = await props.searchParams;
  const timeZone = resolveCalendarTimeZone(searchParams.tz, await getTimeZone());
  const auth = await requireSession();

  const [session, user, records] = await Promise.all([
    db.session.findUnique({
      where: { id: params.id },
      include: {
        workout: { select: { name: true } },
        program: { select: { name: true } },
        sets: {
          orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                muscleGroup: true,
                category: true,
                usesBodyweight: true,
              },
            },
          },
        },
      },
    }),
    db.user.findUnique({
      where: { id: auth.userId },
      select: { bodyweight: true, unit: true },
    }),
    // Records this session set (lib/personal-records), to mark their sets.
    db.personalRecord.findMany({
      where: { userId: auth.userId, sessionId: params.id },
      select: { exerciseId: true, weightKg: true, reps: true },
    }),
  ]);

  if (!session || session.userId !== auth.userId) {
    notFound();
  }
  const bodyweight = user?.bodyweight ?? null;
  const unit = user?.unit ?? 'KG';

  // Group sets by exercise (keeping the order of the first set per exercise).
  const exerciseOrder: string[] = [];
  const setsByExercise = new Map<
    string,
    { exercise: (typeof session.sets)[number]['exercise']; sets: typeof session.sets }
  >();
  for (const s of session.sets) {
    let entry = setsByExercise.get(s.exerciseId);
    if (!entry) {
      entry = { exercise: s.exercise, sets: [] };
      setsByExercise.set(s.exerciseId, entry);
      exerciseOrder.push(s.exerciseId);
    }
    entry.sets.push(s);
  }

  // For tonnage, we enrich the sets with their usesBodyweight + the user's
  // bodyweight. Exercises that are not flagged stay unchanged.
  const enrichedAllSets = applyBodyweight(
    session.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      isWarmup: s.isWarmup,
      durationSec: s.durationSec,
      usesBodyweight: s.exercise.usesBodyweight,
    })),
    bodyweight,
  );
  const volume = totalVolume(enrichedAllSets);
  const workingSetCount = session.sets.filter((s) => !s.isWarmup).length;
  // TCX export (issue #175) is offered only for a FINISHED session that has
  // cardio sets; the route 400s on a cardio-less session, and an in-progress
  // session (reachable only by direct URL here) is not a complete export.
  const hasCardio = session.finishedAt != null && session.sets.some((s) => s.durationSec != null);
  const durationMin =
    session.finishedAt && session.startedAt
      ? Math.round((session.finishedAt.getTime() - session.startedAt.getTime()) / 60000)
      : null;
  const sessionTitle = session.workout?.name
    ? getTrainingDisplayName(session.workout.name, locale)
    : t('freeSession');
  const programName = session.program
    ? getTrainingDisplayName(session.program.name, locale)
    : null;
  // A working set is marked when a record of this session names its exercise,
  // load and reps (the record's load already counts the bodyweight).
  const isRecordSet = (exerciseId: string, effective: number, reps: number) =>
    records.some(
      (record) =>
        record.exerciseId === exerciseId &&
        record.reps === reps &&
        record.weightKg != null &&
        Math.abs(record.weightKg - effective) < 0.01,
    );
  // "Copy as text" (issue #405) recaps a FINISHED session only, like the TCX
  // export: an in-progress session is not a log worth pasting yet.
  const workoutText =
    session.finishedAt != null && exerciseOrder.length > 0
      ? formatWorkoutText(
          {
            title: sessionTitle,
            date: format.dateTime(session.startedAt, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone,
            }),
            notes: session.notes,
            exercises: exerciseOrder.flatMap((exerciseId) => {
              const entry = setsByExercise.get(exerciseId);
              if (!entry) return [];
              return [
                {
                  name: getExerciseDisplayName(entry.exercise.name, locale),
                  isCardio: entry.exercise.category === 'CARDIO',
                  usesBodyweight: entry.exercise.usesBodyweight,
                  sets: entry.sets,
                },
              ];
            }),
          },
          {
            unit,
            locale,
            labels: {
              warmup: copyT('warmup'),
              dropSet: copyT('dropSet'),
              bodyweight: detail('bodyweight'),
              setNote: (number) => detail('setNote', { number }),
              notes: copyT('notes'),
            },
          },
        )
      : null;

  const dateLine = format.dateTime(session.startedAt, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  const summary = [
    common('counts.sets', { count: workingSetCount }),
    common('counts.exercises', { count: setsByExercise.size }),
    volume > 0 ? formatWeight(volume, unit, { decimals: 0, locale }) : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <header className="flex items-center gap-1 px-2 pt-2">
        <IconButton asChild aria-label={detail('back')}>
          <Link href={buildBackHref(searchParams)}>
            <CaretLeftIcon />
          </Link>
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
          {programName ?? t('title')}
        </span>
      </header>

      <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.025em]">
            {sessionTitle}
          </h1>
          <p className="text-caption text-muted-foreground first-letter:uppercase">
            {[dateLine, durationMin != null ? t('minutes', { count: durationMin }) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="font-num text-caption font-semibold tabular-nums stretch-108">
            {summary.join(' · ')}
          </p>
        </div>

        {session.notes && (
          <div className="flex flex-col gap-1 border-y border-border py-3.5">
            <span className="text-small font-semibold text-muted-foreground">
              {detail('notes')}
            </span>
            <p className="whitespace-pre-line text-[0.9375rem] leading-normal text-pretty">
              {session.notes}
            </p>
          </div>
        )}

        {exerciseOrder.length === 0 ? (
          <p className="border-t border-border py-4 text-caption text-muted-foreground">
            {detail('noSets')}
          </p>
        ) : (
          <ol className="flex flex-col gap-6">
            {exerciseOrder.map((exerciseId) => {
              const entry = setsByExercise.get(exerciseId);
              if (!entry) return null;
              const isCardio = entry.exercise.category === 'CARDIO';
              const exerciseName = getExerciseDisplayName(entry.exercise.name, locale);
              const enrichedExoSets = applyBodyweight(
                entry.sets.map((s) => ({
                  weight: s.weight,
                  reps: s.reps,
                  isWarmup: s.isWarmup,
                  durationSec: s.durationSec,
                  usesBodyweight: entry.exercise.usesBodyweight,
                })),
                bodyweight,
              );
              const exoVolume = totalVolume(enrichedExoSets);
              const e1rm = best1RM(enrichedExoSets);
              // Cardio recap (issue #133): totals across the WORKING sets, with
              // derived pace and speed (issue #177) appended when a distance was
              // covered (omitted for duration-only cardio). Warmups are excluded
              // (issue #183), matching the working-set convention used elsewhere.
              const { durationSec: cardioDurationTotal, distanceM: cardioDistanceTotal } =
                sumCardioWorkingSets(entry.sets);
              const cardioTotal = isCardio
                ? [
                    formatCardioSet(cardioDurationTotal, cardioDistanceTotal),
                    formatPace(cardioDurationTotal, cardioDistanceTotal, unit),
                    formatSpeed(cardioDurationTotal, cardioDistanceTotal, unit),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : null;
              const meta = [
                exerciseT(`muscleGroups.${muscleGroupMessageKeys[entry.exercise.muscleGroup]}`),
                cardioTotal
                  ? detail('total', { value: cardioTotal })
                  : detail('volume', {
                      value: formatWeight(exoVolume, unit, { decimals: 0, locale }),
                    }),
                e1rm > 0
                  ? detail('oneRm', {
                      value: formatWeight(e1rm, unit, {
                        decimals: 1,
                        fixed: true,
                        group: false,
                        locale,
                      }),
                    })
                  : null,
              ].filter(Boolean);
              return (
                <li key={exerciseId} className="flex flex-col gap-1 border-t border-border pt-4">
                  <h2 className="text-subtitle">{exerciseName}</h2>
                  <p className="text-[0.8125rem] font-medium text-muted-foreground">
                    {meta.join(' · ')}
                  </p>
                  {isCardio ? (
                    <div className="-mx-5 overflow-x-auto px-5 scrollbar-none">
                      <table className="w-full min-w-[22rem] border-collapse text-caption">
                        <caption className="sr-only">{exerciseName}</caption>
                        <thead>
                          <tr className="border-b border-border">
                            <th scope="col" className={TH}>
                              #
                            </th>
                            <th scope="col" className={TH}>
                              {detail('duration')}
                            </th>
                            <th scope="col" className={TH}>
                              {detail('distance')}
                            </th>
                            <th scope="col" className={TH}>
                              {detail('pace')}
                            </th>
                            <th scope="col" className={TH}>
                              {detail('avgHr')}
                            </th>
                            <th scope="col" className={TH}>
                              {detail('maxHr')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.sets.map((s) => {
                            const pace =
                              s.durationSec != null
                                ? formatPace(s.durationSec, s.distanceM, unit)
                                : null;
                            return (
                              <tr key={s.id} className="border-b border-border">
                                <td className={TD}>
                                  <Num stretch={112}>{s.setNumber}</Num>
                                </td>
                                <td className={TD}>
                                  <Num stretch={112}>
                                    {s.durationSec != null ? formatDuration(s.durationSec) : '-'}
                                  </Num>
                                </td>
                                <td className={TD}>
                                  <Num stretch={112}>
                                    {s.distanceM != null && s.distanceM > 0
                                      ? formatDistance(s.distanceM)
                                      : '-'}
                                  </Num>
                                </td>
                                <td className={TD}>
                                  <Num stretch={112}>{pace ?? '-'}</Num>
                                </td>
                                <td className={TD}>
                                  <Num stretch={112}>
                                    {s.avgHr != null ? `${s.avgHr} bpm` : '-'}
                                  </Num>
                                </td>
                                <td className={TD}>
                                  <Num stretch={112}>
                                    {s.maxHr != null ? `${s.maxHr} bpm` : '-'}
                                  </Num>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Fixed layout: the columns line up from one exercise to the next.
                    <table className="w-full table-fixed border-collapse text-caption">
                      <caption className="sr-only">{exerciseName}</caption>
                      <thead>
                        <tr className="border-b border-border">
                          <th scope="col" className={`${TH} w-10`}>
                            #
                          </th>
                          <th scope="col" className={`${TH} w-[40%]`}>
                            {detail('load')}
                          </th>
                          <th scope="col" className={`${TH} w-[16%]`}>
                            {detail('reps')}
                          </th>
                          <th scope="col" className={`${TH} w-[14%]`}>
                            RIR
                          </th>
                          <th scope="col" className={`${TH} text-right`}>
                            {detail('type')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.sets.map((s) => {
                          const isBw = entry.exercise.usesBodyweight && bodyweight;
                          const effective = isBw ? bodyweight + s.weight : s.weight;
                          const record =
                            !s.isWarmup && isRecordSet(exerciseId, effective, s.reps);
                          const load =
                            !isBw && effective === 0
                              ? detail('bodyweight')
                              : formatWeight(effective, unit, {
                                  decimals: 2,
                                  group: false,
                                  locale,
                                });
                          return (
                            <tr
                              key={s.id}
                              className={
                                s.isWarmup
                                  ? 'border-b border-border text-muted-foreground'
                                  : 'border-b border-border'
                              }
                            >
                              <td className={TD}>
                                <Num stretch={112}>{s.setNumber}</Num>
                              </td>
                              <td className={TD}>
                                {record ? (
                                  <Highlight stretch={112} title={detail('record')}>
                                    {load}
                                    <span className="sr-only"> ({detail('record')})</span>
                                  </Highlight>
                                ) : (
                                  <Num stretch={112}>{load}</Num>
                                )}
                                {isBw && (
                                  <span className="ml-1 text-small text-muted-foreground">
                                    ({s.weight >= 0 ? '+' : ''}
                                    {formatWeight(s.weight, unit, {
                                      decimals: 2,
                                      withUnit: false,
                                      group: false,
                                      locale,
                                    })}{' '}
                                    {detail('external')})
                                  </span>
                                )}
                              </td>
                              <td className={TD}>
                                <Num stretch={112}>{s.reps}</Num>
                              </td>
                              <td className={TD}>
                                <Num stretch={112}>{s.rir ?? '-'}</Num>
                              </td>
                              <td className={`${TD} text-right`}>
                                {s.isWarmup ? (
                                  <Tag variant="warmup">{detail('warmup')}</Tag>
                                ) : s.isDropSet ? (
                                  <Tag variant="muted">{detail('dropSet')}</Tag>
                                ) : (
                                  <span className="text-small text-muted-foreground">
                                    {detail('working')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {isCardio &&
                    entry.sets.map((s) => {
                      if (!Array.isArray(s.track) || s.track.length === 0) return null;
                      const track = s.track as { t: number; d?: number; hr?: number }[];
                      return (
                        <div key={`track-${s.id}`}>
                          <ActivityTrackChart track={track} />
                          <TrackDecoupling track={track} />
                        </div>
                      );
                    })}
                  {entry.sets.some((s) => s.notes) && (
                    <div className="mt-1 flex flex-col gap-1 text-[0.8125rem] text-muted-foreground">
                      {entry.sets
                        .filter((s) => s.notes)
                        .map((s) => (
                          <p key={s.id}>
                            <span className="font-semibold">
                              {detail('setNote', { number: s.setNumber })}{' '}
                            </span>
                            {s.notes}
                          </p>
                        ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-wrap gap-2 border-t border-border pt-5">
          {workoutText && <CopyWorkoutButton text={workoutText} />}
          {hasCardio && (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/cardio/tcx?sessionId=${session.id}`} download>
                <DownloadSimpleIcon weight="bold" />
                {detail('downloadTcx')}
              </a>
            </Button>
          )}
          <DeleteSessionButton
            sessionId={session.id}
            workoutName={
              session.workout?.name ? getTrainingDisplayName(session.workout.name, locale) : null
            }
            startedAt={session.startedAt}
          />
        </div>
      </div>
    </main>
  );
}
