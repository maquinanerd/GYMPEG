import Link from 'next/link';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { PersonalRecordType, WeightUnit } from '@/lib/prisma-client';
import type { CompactMuscle } from '@/lib/muscle-map';
import type { GreetingPeriod, WeekDayStatus } from '@/lib/home-week';
import type { HomeInsightKind } from '@/lib/home-insight';
import { formatWeight } from '@/lib/units';
import { cn } from '@/lib/utils';
import { SyncStatus } from '@/components/offline/sync-status';
import { StartWorkoutButton } from '@/components/session/start-workout-button';
import { MuscleMap } from '@/components/progress/muscle-map';
import { Button } from '@/components/ui/button';
import { Tag, type TagVariant } from '@/components/ui/tag';
import { Num } from '@/components/ui/num';
import { Highlight } from '@/components/ui/highlight';
import { LimeBlock } from '@/components/ui/lime-block';
import { ListRow } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Section, textLinkClass } from '@/components/ui/section';
import { WeekStrip, type DayCellState, type WeekStripItem } from '@/components/ui/week-strip';
import { sparkline, type SparkPoint } from '@/components/home/sparkline';

// The home screen ("Início", design v2): date, greeting and sync tag; the
// lime block of today's workout; this week against the plan; one computed
// alert; the latest records and the bodyweight with its sparkline. A view
// over plain data: app/(app)/page.tsx loads it, nothing here hits the DB.

export interface HomeWeekDay {
  key: string;
  // Noon of the day (UTC fields); formatted with timeZone UTC.
  date: Date;
  status: WeekDayStatus;
  trained: boolean;
}

// One exercise of the workout as prescribed: "4 × 5‑8".
export interface HomeExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
}

export type HomeNext =
  | {
      kind: 'inProgress';
      sessionId: string;
      title: string;
      elapsedMinutes: number;
      setsDone: number;
      setsTotal: number;
      muscles: CompactMuscle[];
      exercises: HomeExercise[];
    }
  | {
      kind: 'next';
      workoutId: string;
      title: string;
      // Cycle week ("Semana 3 de 5") or the program name.
      kicker: string;
      // This week (or a deload the lifter started) runs lighter.
      deload: boolean;
      // The program schedules this workout for today.
      scheduledToday: boolean;
      minutes: number | null;
      reason: string;
      muscles: CompactMuscle[];
      exercises: HomeExercise[];
    }
  | { kind: 'choose'; programName: string }
  | { kind: 'empty'; programId: string; programName: string; reason: string }
  | { kind: 'noProgram' }
  | { kind: 'new' };

export interface HomeRecord {
  id: string;
  type: PersonalRecordType;
  exerciseName: string | null;
  value: number;
  previousValue: number;
  weightKg: number | null;
  achievedAt: Date;
}

export interface HomeData {
  name: string;
  greeting: GreetingPeriod;
  now: Date;
  timeZone: string;
  unit: WeightUnit;
  week: HomeWeekDay[];
  next: HomeNext;
  weekStats: {
    sessionsDone: number;
    sessionsPlanned: number | null;
    setsDone: number;
    setsPrescribed: number | null;
  };
  insight: { kind: HomeInsightKind; title: string; detail: string; href: string } | null;
  records: HomeRecord[];
  weight: {
    latestKg: number;
    averageKg: number | null;
    ratePerWeekKg: number | null;
    // Weigh-ins of the lookback window, any order.
    series: SparkPoint[];
  } | null;
}

export function HomeView({ data }: { data: HomeData }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-7">
      <HomeHeader data={data} />
      <TodayBlock next={data.next} />
      <ThisWeek data={data} />
      {data.insight && <InsightAlert insight={data.insight} />}
      <RecentRecords records={data.records} unit={data.unit} timeZone={data.timeZone} />
      {data.weight && (
        <WeightSection
          weight={data.weight}
          unit={data.unit}
          className={data.records.length > 0 ? 'mt-4' : 'mt-7'}
        />
      )}
    </main>
  );
}

function HomeHeader({ data }: { data: HomeData }) {
  const t = useTranslations('dashboard.home');
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: data.timeZone,
  }).format(data.now);
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-[18px] pt-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-caption text-muted-foreground">{date}</p>
        <h1 className="text-title [overflow-wrap:anywhere]">
          {t(`greeting.${data.greeting}`, { name: data.name })}
        </h1>
      </div>
      <SyncStatus />
    </header>
  );
}

// "4 × 5‑8" (non-breaking hyphen), or "3 × 10" for a fixed target.
function prescription(exercise: HomeExercise): string {
  const reps =
    exercise.repsMin === exercise.repsMax
      ? String(exercise.repsMin)
      : `${exercise.repsMin}‑${exercise.repsMax}`;
  return `${exercise.sets} × ${reps}`;
}

// Past this many the list folds the rest into "+ N exercícios".
const LISTED_EXERCISES = 6;

function ExerciseList({ exercises }: { exercises: HomeExercise[] }) {
  const t = useTranslations('dashboard.home.next');
  // Never fold a single exercise: listing it takes the same room.
  const shown =
    exercises.length > LISTED_EXERCISES + 1 ? exercises.slice(0, LISTED_EXERCISES) : exercises;
  const folded = exercises.length - shown.length;
  return (
    <div className="flex flex-col">
      <ol aria-label={t('exerciseList')} className="flex flex-col">
        {shown.map((exercise, index) => (
          <li
            key={`${index}-${exercise.name}`}
            className="flex items-baseline justify-between gap-3 border-t border-ink/[0.14] py-[9px] text-body"
          >
            <span className="min-w-0">{exercise.name}</span>
            <Num className="whitespace-nowrap text-caption">{prescription(exercise)}</Num>
          </li>
        ))}
      </ol>
      {folded > 0 && (
        <p className="border-t border-ink/[0.14] py-[9px] text-caption font-semibold text-brand-strong">
          {t('moreExercises', { count: folded })}
        </p>
      )}
    </div>
  );
}

// Text link on the lime fill: ink text, 44px tall hit area.
const limeLinkClass =
  'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-xs font-semibold text-primary-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// The lime block: today's workout (or the workout in progress), and with the
// same shape the no-program, empty-program and new-account states.
function TodayBlock({ next }: { next: HomeNext }) {
  const t = useTranslations('dashboard.home.next');
  const dashboardT = useTranslations('dashboard');

  let kicker: React.ReactNode;
  let title: string;
  let body: string | null = null;
  let exercises: HomeExercise[] | null = null;
  let muscles: CompactMuscle[] | null = null;
  let action: React.ReactNode;
  let foot: string | null = null;
  let footLink: { href: string; label: string } | null = null;

  const linkAction = (href: string, label: string) => (
    <Button asChild variant="ink" className="w-full">
      <Link href={href}>{label}</Link>
    </Button>
  );

  switch (next.kind) {
    case 'inProgress':
      kicker = t('inProgress', { minutes: next.elapsedMinutes });
      title = next.title;
      exercises = next.exercises;
      muscles = next.muscles;
      action = linkAction(`/session/${next.sessionId}`, t('resume'));
      foot = t('setsLogged', { done: next.setsDone, total: next.setsTotal });
      break;
    case 'next':
      kicker = (
        <>
          <span>{next.scheduledToday ? `${t('today')} · ${next.kicker}` : next.kicker}</span>
          {next.deload && <Tag variant="deload">{t('deload')}</Tag>}
        </>
      );
      title = next.title;
      exercises = next.exercises;
      muscles = next.muscles;
      action = (
        <StartWorkoutButton workoutId={next.workoutId} label={t('start')} variant="ink" />
      );
      foot =
        next.minutes != null
          ? `${next.reason} · ${t('minutes', { count: next.minutes })}`
          : next.reason;
      footLink = { href: '/session/new', label: t('switch') };
      break;
    case 'choose':
      kicker = next.programName;
      title = t('chooseTitle');
      action = linkAction('/session/new', dashboardT('chooseSession'));
      break;
    case 'empty':
      kicker = t('emptyTag');
      title = next.programName;
      body = next.reason;
      action = linkAction(`/programs/${next.programId}`, dashboardT('configureProgram'));
      break;
    case 'noProgram':
      kicker = t('noProgramTag');
      title = t('noProgramTitle');
      body = t('noProgramReason');
      action = linkAction('/programs/new/template', t('chooseProgram'));
      foot = t('noProgramMeta');
      footLink = { href: '/programs/new', label: t('createProgram') };
      break;
    case 'new':
      kicker = t('newTag');
      title = dashboardT('onboardingTitle');
      body = t('newIntro');
      action = linkAction('/onboarding', t('newCta'));
      foot = t('newReason');
      footLink = { href: '/exercises', label: t('explore') };
      break;
  }

  return (
    <LimeBlock data-testid="next-workout" aria-labelledby="home-today-title" className="pb-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption font-semibold text-brand-strong">
            {kicker}
          </p>
          <h2
            id="home-today-title"
            className="text-display [overflow-wrap:anywhere] [text-wrap:balance]"
          >
            {title}
          </h2>
        </div>
        {muscles && muscles.length > 0 && <MuscleMap active={muscles} theme="lime" size={92} />}
      </div>
      {body && <p className="text-body text-brand-strong [text-wrap:pretty]">{body}</p>}
      {exercises && exercises.length > 0 && <ExerciseList exercises={exercises} />}
      {action}
      {(foot || footLink) && (
        <div className="-my-2 flex min-h-11 items-center justify-between gap-3 text-caption text-brand-strong">
          <span className="min-w-0 [text-wrap:pretty]">{foot}</span>
          {footLink && (
            <Link href={footLink.href} className={limeLinkClass}>
              {footLink.label}
            </Link>
          )}
        </div>
      )}
    </LimeBlock>
  );
}

const DAY_STATE: Record<WeekDayStatus, DayCellState> = {
  today: 'today',
  trained: 'done',
  planned: 'planned',
  rest: 'rest',
};

function WeekNumber({
  value,
  caption,
  planned,
}: {
  value: number;
  caption: string;
  planned: number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <Num className="text-[1.75rem] leading-none">{value}</Num>
        <span className="text-caption text-muted-foreground">{caption}</span>
      </p>
      {/* The bar repeats the sentence above for sighted users only. */}
      {planned != null && planned > 0 && <ProgressBar value={value} max={planned} />}
    </div>
  );
}

function ThisWeek({ data }: { data: HomeData }) {
  const t = useTranslations('dashboard.home');
  const locale = useLocale();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });
  const fullDay = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const first = data.week[0];
  const last = data.week.at(-1);
  const range =
    first && last
      ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
          .formatRange(first.date, last.date)
      : undefined;

  const days: WeekStripItem[] = data.week.map((day) => ({
    key: day.key,
    // "seg." → "seg".
    weekday: weekday.format(day.date).replace(/\.$/u, ''),
    day: dayNumber.format(day.date),
    state: DAY_STATE[day.status],
    label: `${fullDay.format(day.date)}: ${t(`dayStatus.${day.status}`)}${
      day.status === 'today' && day.trained ? `, ${t('dayStatus.trained')}` : ''
    }`,
  }));

  const { sessionsDone, sessionsPlanned, setsDone, setsPrescribed } = data.weekStats;
  return (
    <Section title={t('thisWeek')} aside={range} className="gap-3.5 px-5 pt-7">
      <WeekStrip days={days} />
      <div data-testid="weekly-adherence" className="grid grid-cols-2 gap-6 pt-1.5">
        <WeekNumber
          value={sessionsDone}
          planned={sessionsPlanned}
          caption={
            sessionsPlanned != null
              ? t('week.sessionsOf', { count: sessionsPlanned })
              : t('week.sessionsThisWeek', { count: sessionsDone })
          }
        />
        <WeekNumber
          value={setsDone}
          planned={setsPrescribed}
          caption={
            setsPrescribed != null
              ? t('week.setsOf', { count: setsPrescribed })
              : t('week.setsThisWeek', { count: setsDone })
          }
        />
      </div>
    </Section>
  );
}

const INSIGHT_TAG: Record<
  HomeInsightKind,
  { key: 'stall' | 'deload' | 'pr' | 'onTrack'; variant: TagVariant }
> = {
  stall: { key: 'stall', variant: 'warning' },
  deload: { key: 'deload', variant: 'deload' },
  pr: { key: 'pr', variant: 'pr' },
  'on-track': { key: 'onTrack', variant: 'muted' },
};

// The one alert computed by the domain (lib/home-insight): a tag naming the
// kind, the title (link to where to act) and the detail. Not AI: no italic.
function InsightAlert({ insight }: { insight: NonNullable<HomeData['insight']> }) {
  const t = useTranslations('dashboard.home.insight');
  const look = INSIGHT_TAG[insight.kind];
  return (
    <section
      aria-labelledby="home-insight-title"
      data-insight={insight.kind}
      className="mx-5 mt-7 flex flex-col gap-2 border-t border-border pt-5"
    >
      <Tag variant={look.variant}>{t(look.key)}</Tag>
      <h2 id="home-insight-title" className="text-subtitle">
        <Link
          href={insight.href}
          className="rounded-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {insight.title}
        </Link>
      </h2>
      <p className="text-[0.9375rem] font-medium leading-[1.45] text-muted-foreground [text-wrap:pretty]">
        {insight.detail}
      </p>
    </section>
  );
}

const RECORD_LABEL_KEYS = {
  WEIGHT: 'weight',
  REPS: 'reps',
  E1RM: 'e1rm',
  SET_VOLUME: 'setVolume',
  EXERCISE_VOLUME: 'exerciseVolume',
  WORKOUT_TONNAGE: 'workoutTonnage',
  WEEKLY_TONNAGE: 'weeklyTonnage',
} as const satisfies Record<PersonalRecordType, string>;

function RecentRecords({
  records,
  unit,
  timeZone,
}: {
  records: HomeRecord[];
  unit: WeightUnit;
  timeZone: string;
}) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const format = useFormatter();
  if (records.length === 0) return null;
  const number = (kg: number) => formatWeight(kg, unit, { decimals: 1, locale, withUnit: false });
  const withUnit = (kg: number) => formatWeight(kg, unit, { decimals: 1, locale });

  return (
    <Section
      title={t('records.title')}
      action={
        <Link href="/progress" className={cn(textLinkClass, '-my-3 inline-flex min-h-11 items-center')}>
          {t('home.records.viewAll')}
        </Link>
      }
      className="mx-5 mt-7 gap-1.5"
    >
      <ul data-testid="recent-records">
        {records.map((record) => {
          const date = format.dateTime(record.achievedAt, {
            day: '2-digit',
            month: '2-digit',
            timeZone,
          });
          const label = t(`home.records.${RECORD_LABEL_KEYS[record.type]}`);
          const reps = record.type === 'REPS';
          // Load records keep the unit on both sides; volumes drop it before
          // the arrow so the pair fits a phone row.
          const load = record.type === 'WEIGHT' || record.type === 'E1RM';
          const before = reps
            ? `× ${record.previousValue}`
            : load
              ? withUnit(record.previousValue)
              : number(record.previousValue);
          const after = reps ? `× ${record.value}` : withUnit(record.value);
          return (
            <ListRow
              key={record.id}
              title={record.exerciseName ?? label}
              meta={reps ? `${withUnit(record.weightKg ?? 0)} · ${date}` : `${label} · ${date}`}
              // `trailing`, not `value`: ListRow's `value` collides with the
              // <li value> attribute type and only takes strings.
              trailing={
                <span className="flex items-baseline justify-end gap-2 whitespace-nowrap">
                  <span className="text-caption text-muted-foreground">
                    <span className="sr-only">{t('home.records.previous')} </span>
                    {before}
                  </span>
                  <Highlight stretch={125} className="text-body">
                    {after}
                  </Highlight>
                </span>
              }
            />
          );
        })}
      </ul>
    </Section>
  );
}

const SPARK_WIDTH = 112;
const SPARK_HEIGHT = 40;

function WeightSection({
  weight,
  unit,
  className,
}: {
  weight: NonNullable<HomeData['weight']>;
  unit: WeightUnit;
  className?: string;
}) {
  const t = useTranslations('dashboard.home.weight');
  const locale = useLocale();
  const value = formatWeight(weight.latestKg, unit, {
    decimals: 1,
    fixed: true,
    locale,
    withUnit: false,
  });
  const parts = [
    weight.averageKg != null
      ? t('average', {
          value: formatWeight(weight.averageKg, unit, {
            decimals: 1,
            fixed: true,
            locale,
            withUnit: false,
          }),
        })
      : null,
    weight.ratePerWeekKg != null
      ? t('rate', {
          value: `${weight.ratePerWeekKg > 0 ? '+' : weight.ratePerWeekKg < 0 ? '−' : ''}${formatWeight(
            Math.abs(weight.ratePerWeekKg),
            unit,
            { decimals: 1, fixed: true, locale },
          )}`,
        })
      : null,
  ].filter(Boolean);
  // Kilograms or pounds draw the same shape: the scale is linear.
  const line = sparkline(weight.series, { width: SPARK_WIDTH, height: SPARK_HEIGHT });

  return (
    <section
      data-testid="home-weight"
      aria-labelledby="home-weight-title"
      className={cn(
        'mx-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-t border-border pt-5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="home-weight-title" className="text-caption font-semibold text-muted-foreground">
          {t('title')}
        </h2>
        <p className="flex items-baseline gap-1">
          <Num className="text-[1.75rem] leading-none">{value}</Num>
          <span className="text-caption text-muted-foreground">{unit === 'LB' ? 'lb' : 'kg'}</span>
        </p>
        {parts.length > 0 && (
          <p className="text-[0.8125rem] font-medium text-muted-foreground">{parts.join(' · ')}</p>
        )}
      </div>
      {line && (
        <svg
          width={SPARK_WIDTH}
          height={SPARK_HEIGHT}
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          aria-hidden
          data-testid="weight-sparkline"
          className="shrink-0 text-ink"
        >
          <polyline
            points={line.points}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={line.end.x} cy={line.end.y} r={3} fill="currentColor" />
        </svg>
      )}
    </section>
  );
}
