import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CaretLeftIcon } from '@/components/ui/icon';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import {
  equipmentTypeMessageKeys,
  exerciseCategoryMessageKeys,
  muscleGroupMessageKeys,
} from '@/i18n/enum-keys';
import { estimate1RM } from '@/lib/stats';
import { formatWeight, unitLabel } from '@/lib/units';
import { ExerciseMediaDialog } from '@/components/exercises/exercise-media-dialog';
import { ExerciseBodyMap } from '@/components/exercises/exercise-body-map';
import { ExerciseOwnerActions } from '@/components/exercises/exercise-owner-actions';
import { exerciseMuscleMap } from '@/lib/muscle-map';
import { muscleContributions } from '@/lib/training-engine/volume';
import { IconButton } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import { Section, textLinkClass } from '@/components/ui/section';
import { safeSessionReturnPath } from '@/lib/session-exercise-navigation';
import { usableExerciseWhere } from '@/lib/catalog/access';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function ExerciseDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo: requestedReturnTo } = await searchParams;
  const auth = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations('exercises.detail');
  const exerciseT = await getTranslations('exercises');
  const format = await getFormatter();

  const [exercise, user] = await Promise.all([
    db.exercise.findFirst({
      where: { id, ...usableExerciseWhere(auth.userId) },
      include: {
        muscles: { include: { muscle: true } },
        sets: {
          where: { isWarmup: false, session: { userId: auth.userId } },
          orderBy: { completedAt: 'desc' },
          take: 100,
          include: {
            session: { select: { id: true, startedAt: true } },
          },
        },
      },
    }),
    db.user.findUnique({ where: { id: auth.userId }, select: { unit: true } }),
  ]);

  if (!exercise) notFound();
  const muscleName = (m: { namePtBr: string; nameEn: string }) =>
    locale === 'pt-BR' ? m.namePtBr : m.nameEn;
  const primaryMuscles = exercise.muscles
    .filter((m) => m.role === 'PRIMARY')
    .map((m) => muscleName(m.muscle));
  const secondaryMuscles = exercise.muscles
    .filter((m) => m.role !== 'PRIMARY')
    .map((m) => muscleName(m.muscle));
  const returnTo = safeSessionReturnPath(requestedReturnTo);
  const displayName = getExerciseDisplayName(exercise.name, locale);
  const unit = user?.unit ?? 'KG';
  const sessions = new Map<string, { id: string; startedAt: Date; sets: typeof exercise.sets }>();
  for (const set of exercise.sets) {
    const existing = sessions.get(set.session.id);
    if (existing) existing.sets.push(set);
    else
      sessions.set(set.session.id, {
        id: set.session.id,
        startedAt: set.session.startedAt,
        sets: [set],
      });
  }
  const recentSessions = [...sessions.values()]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 12);

  const muscleLabel = exerciseT(`muscleGroups.${muscleGroupMessageKeys[exercise.muscleGroup]}`);
  const equipmentLabel = exerciseT(
    `equipmentTypes.${equipmentTypeMessageKeys[exercise.equipmentType]}`,
  );
  const categoryLabel = exerciseT(`categories.${exerciseCategoryMessageKeys[exercise.category]}`);
  // The plain row for the edit dialog (a client component): no relations.
  const { muscles: _muscles, sets: _sets, ...plainExercise } = exercise;
  const isOwn = exercise.userId === auth.userId;

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t('muscle'), value: muscleLabel },
    ...(primaryMuscles.length > 0
      ? [{ label: t('primaryMuscles'), value: primaryMuscles.join(', ') }]
      : []),
    ...(secondaryMuscles.length > 0
      ? [{ label: t('secondaryMuscles'), value: secondaryMuscles.join(', ') }]
      : []),
    { label: t('equipment'), value: equipmentLabel },
    {
      label: t('defaultRest'),
      value: (
        <Num stretch={112}>
          {exercise.defaultRestSec} {t('seconds')}
        </Num>
      ),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <header className="flex items-center gap-1 px-2 pt-2">
        <IconButton asChild aria-label={t(returnTo ? 'backToSession' : 'back')}>
          <Link href={returnTo ?? '/exercises'}>
            <CaretLeftIcon />
          </Link>
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
          {muscleLabel}
        </span>
      </header>

      <div className="flex flex-col gap-7 px-5 pb-8 pt-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.025em]">
              {displayName}
            </h1>
            {displayName !== exercise.name && (
              <p className="text-caption text-muted-foreground">{exercise.name}</p>
            )}
            <p className="text-caption text-muted-foreground">
              {[muscleLabel, equipmentLabel, categoryLabel].join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExerciseMediaDialog
              exerciseName={exercise.name}
              displayName={displayName}
              equipmentType={exercise.equipmentType}
            />
            {isOwn && <ExerciseOwnerActions exercise={plainExercise} displayName={displayName} />}
          </div>
        </div>

        <Section title={t('information')} divider>
          <dl className="flex flex-col">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
              >
                <dt className="text-caption text-muted-foreground">{fact.label}</dt>
                <dd className="text-right text-body font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <ExerciseBodyMap
            regions={exerciseMuscleMap(
              muscleContributions({
                muscleGroup: exercise.muscleGroup,
                muscles: exercise.muscles.map((m) => ({ role: m.role, group: m.muscle.group })),
              }),
            )}
          />
          {exercise.notes && (
            <p className="whitespace-pre-line border-y border-border py-3.5 text-[0.9375rem] leading-normal text-pretty">
              {exercise.notes}
            </p>
          )}
        </Section>

        {exercise.instructionsPtBr.length > 0 && (
          <Section title={t('howTo')} divider lang="pt-BR">
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-body marker:font-semibold marker:text-muted-foreground">
              {exercise.instructionsPtBr.map((step) => (
                <li key={step} className="pl-1 text-pretty">
                  {step}
                </li>
              ))}
            </ol>
            {exercise.commonMistakesPtBr.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <h3 className="text-subtitle">{t('commonMistakes')}</h3>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-caption text-muted-foreground">
                  {exercise.commonMistakesPtBr.map((mistake) => (
                    <li key={mistake} className="text-pretty">
                      {mistake}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        <Section
          title={t('history')}
          divider
          action={
            <Link href={`/progress?exerciseId=${exercise.id}`} className={textLinkClass}>
              {t('openChart')}
            </Link>
          }
        >
          {recentSessions.length === 0 ? (
            <p className="text-caption text-muted-foreground">{t('noHistory')}</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {recentSessions.map((session) => {
                const date = format.dateTime(session.startedAt, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <li key={session.id} className="flex flex-col gap-1 border-t border-border pt-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <Num stretch={112} className="text-caption">
                        {date}
                      </Num>
                      <Link href={`/history/${session.id}`} className={textLinkClass}>
                        {t('openSession')}
                      </Link>
                    </div>
                    <table className="w-full border-collapse text-caption">
                      <caption className="sr-only">{date}</caption>
                      <thead>
                        <tr className="text-small text-muted-foreground">
                          <th scope="col" className="py-1.5 text-left font-semibold">
                            {t('set')}
                          </th>
                          <th scope="col" className="py-1.5 text-right font-semibold">
                            {unitLabel(unit)}
                          </th>
                          <th scope="col" className="py-1.5 text-right font-semibold">
                            {t('reps')}
                          </th>
                          <th scope="col" className="py-1.5 text-right font-semibold">
                            {t('estimatedMax')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...session.sets]
                          .sort((a, b) => a.setNumber - b.setNumber)
                          .map((set) => (
                            <tr key={set.id} className="border-t border-border">
                              <td className="py-2">
                                <Num stretch={112}>{set.setNumber}</Num>
                              </td>
                              <td className="py-2 text-right">
                                <Num stretch={112}>
                                  {formatWeight(set.weight, unit, {
                                    decimals: 2,
                                    group: false,
                                    locale,
                                    withUnit: false,
                                  })}
                                </Num>
                              </td>
                              <td className="py-2 text-right">
                                <Num stretch={112}>{set.reps}</Num>
                              </td>
                              <td className="py-2 text-right">
                                <Num stretch={112} className="text-muted-foreground">
                                  {formatWeight(estimate1RM(set.weight, set.reps), unit, {
                                    decimals: 1,
                                    group: false,
                                    locale,
                                  })}
                                </Num>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </main>
  );
}
