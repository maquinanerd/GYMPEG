import Link from 'next/link';
import { PlusIcon } from '@/components/ui/icon';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Section, textLinkClass } from '@/components/ui/section';
import { Tag } from '@/components/ui/tag';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { TrainingHeader } from '@/components/nav/screen-header';
import { CycleBar } from '@/components/programs/cycle-bar';
import { cycleWeekAt, programCycle } from '@/lib/program-cycle';
import { getUserTimeZone } from '@/lib/user-timezone';
import { programTemplates } from '@/lib/programs/templates';
import { cn } from '@/lib/utils';

// The templates offered as chips, in the order of the teaser text; the
// template page lists them all.
const TEMPLATE_CHIPS = ['fiveThreeOneBbb', 'gzclp', 'nsuns', 'ppl', 'upperLower'] as const;

export default async function ProgramsPage() {
  const t = await getTranslations('programs');
  const format = await getFormatter();
  const locale = await getLocale();
  const session = await requireSession();
  const [programs, timeZone] = await Promise.all([
    db.program.findMany({
      where: { userId: session.userId },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      include: {
        _count: { select: { workouts: true, sessions: true } },
        workouts: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            dayOfWeek: true,
            exercises: { select: { targetSets: true } },
          },
        },
        // How the program started (template, AI plan...): its first version.
        revisions: { where: { version: 1 }, select: { source: true }, take: 1 },
      },
    }),
    getUserTimeZone(session.userId),
  ]);

  const active = programs.find((program) => program.isActive) ?? null;
  const others = programs.filter((program) => program !== active);
  const cycle = active ? programCycle(active) : null;
  const cycleWeek = cycle ? cycleWeekAt(cycle, new Date(), timeZone) : null;
  // Short weekday ("seg."): ISO day n is January n of 2024, a Monday-first year.
  const weekdayShort = (day: number) =>
    format.dateTime(new Date(Date.UTC(2024, 0, day, 12)), { weekday: 'short', timeZone: 'UTC' });
  const templates = TEMPLATE_CHIPS.flatMap((key) => {
    const template = programTemplates.find((candidate) => candidate.key === key);
    return template ? [{ slug: template.slug, label: t(`list.templateShort.${key}`) }] : [];
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <TrainingHeader
        action={
          <Button asChild variant="ink" size="sm">
            <Link href="/programs/new">
              <PlusIcon weight="bold" />
              {t('newProgram')}
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-7 px-5 pb-7 pt-5">
        {programs.length === 0 && (
          <EmptyState
            className="py-0"
            title={t('list.emptyTitle')}
            description={t('list.emptyDescription')}
            action={{ label: t('newProgram'), href: '/programs/new' }}
          />
        )}

        {active && (
          <Card className="flex flex-col gap-3.5 px-4 pb-1.5 pt-[18px]">
            <section aria-labelledby="active-program" className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <Tag variant="primary">{t('active')}</Tag>
                <h2
                  id="active-program"
                  className="mt-1 text-[1.375rem] font-semibold leading-tight tracking-[-0.01em]"
                >
                  <Link
                    href={`/programs/${active.id}`}
                    className="rounded-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {getTrainingDisplayName(active.name, locale)}
                  </Link>
                </h2>
                <p className="text-caption text-muted-foreground">
                  {[
                    getTrainingDisplayName(active.phase, locale),
                    t('list.workoutCount', { count: active._count.workouts }),
                    t(`list.scheduleShort.${active.scheduleMode}`),
                  ].join(' · ')}
                </p>
              </div>

              {cycle && cycleWeek != null && <CycleBar cycle={cycle} week={cycleWeek} />}

              {active.workouts.length > 0 && (
                <ol aria-label={t('list.workoutsOf', { name: getTrainingDisplayName(active.name, locale) })}>
                  {active.workouts.map((workout) => {
                    const sets = workout.exercises.reduce((sum, row) => sum + row.targetSets, 0);
                    const fixedDay =
                      active.scheduleMode === 'FIXED_DAYS' && workout.dayOfWeek != null;
                    return (
                      <li key={workout.id} className="border-t border-border">
                        <Link
                          href={`/programs/${active.id}?workout=${workout.id}`}
                          className={cn(
                            'grid min-h-14 items-center gap-2 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                            fixedDay
                              ? 'grid-cols-[2.5rem_minmax(0,1fr)_auto]'
                              : 'grid-cols-[minmax(0,1fr)_auto]',
                          )}
                        >
                          {fixedDay && (
                            <span className="text-[0.8125rem] font-semibold text-muted-foreground">
                              {weekdayShort(workout.dayOfWeek!)}
                            </span>
                          )}
                          <span className="text-body font-semibold">
                            {getTrainingDisplayName(workout.name, locale)}
                          </span>
                          <span className="text-[0.8125rem] font-medium text-muted-foreground">
                            {t('list.workoutMeta', {
                              exercises: workout.exercises.length,
                              sets,
                            })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </Card>
        )}

        {others.length > 0 && (
          <Section title={t('list.others')} className="gap-1.5">
            <ul>
              {others.map((program) => {
                const origin = program.revisions[0]?.source;
                const aiDraft = origin === 'AI_GENERATED' && program.description;
                return (
                  <ListRow
                    key={program.id}
                    href={`/programs/${program.id}`}
                    title={getTrainingDisplayName(program.name, locale)}
                    // An AI plan's description is the coach's text: italic.
                    meta={
                      aiDraft ? (
                        <span className="line-clamp-2 italic">{program.description}</span>
                      ) : (
                        t('list.otherMeta', {
                          phase: getTrainingDisplayName(program.phase, locale),
                          workouts: program._count.workouts,
                          logged: program._count.sessions,
                        })
                      )
                    }
                    trailing={
                      origin === 'TEMPLATE' || origin === 'AI_GENERATED' ? (
                        <Tag variant="muted">{t(`list.origin.${origin}`)}</Tag>
                      ) : undefined
                    }
                    contentClassName="min-h-16"
                  />
                );
              })}
            </ul>
          </Section>
        )}

        <Section title={t('list.fromTemplate')} className="gap-2.5">
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <Button key={template.slug} asChild variant="outline" size="sm">
                <Link href={`/programs/new/template#${template.slug}`}>{template.label}</Link>
              </Button>
            ))}
          </div>
          <div className="flex flex-col items-start gap-1 pt-1">
            <Link
              href="/programs/new/template"
              className={cn(textLinkClass, 'flex min-h-touch items-center')}
            >
              {t('list.allTemplates')}
            </Link>
            <Link
              href="/programs/generate"
              className={cn(textLinkClass, 'flex min-h-touch items-center')}
            >
              {t('list.askCoach')}
            </Link>
          </div>
        </Section>
      </div>
    </main>
  );
}
