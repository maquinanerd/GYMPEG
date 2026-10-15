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
import { Tag, type TagTone } from '@/components/ui/tag';
import { StatTile } from '@/components/ui/stat-tile';
import { IconCircle, ListRow } from '@/components/ui/list-row';
import {
  ArrowRightIcon,
  BarbellIcon,
  CalendarCheckIcon,
  ClockIcon,
  FilesIcon,
  ListChecksIcon,
  ListNumbersIcon,
  PauseIcon,
  PlayIcon,
  ScalesIcon,
  StackIcon,
  TargetIcon,
  TrendUpIcon,
  TrophyIcon,
  BatteryLowIcon,
  type AppIcon,
} from '@/components/ui/icon';

// The home screen ("Início", design round 1): greeting and sync state, the
// week strip, the dominant "next workout" card, the week against the plan,
// one computed insight, the latest records and the bodyweight tile. A view
// over plain data: app/(app)/page.tsx loads it, nothing here hits the DB.

export interface HomeWeekDay {
  key: string;
  // Noon of the day (UTC fields); formatted with timeZone UTC.
  date: Date;
  status: WeekDayStatus;
  trained: boolean;
}

export type HomeNext =
  | {
      kind: 'inProgress';
      sessionId: string;
      title: string;
      elapsedMinutes: number;
      startedAt: Date;
      exerciseCount: number;
      setsDone: number;
      setsTotal: number;
      muscles: CompactMuscle[];
    }
  | {
      kind: 'next';
      workoutId: string;
      title: string;
      // Cycle week ("Semana 3 de 5"), the deload week, or the program name.
      tag: { text: string; tone: TagTone };
      exerciseCount: number;
      setCount: number;
      minutes: number | null;
      reason: string;
      muscles: CompactMuscle[];
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
  initials: string;
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
  weight: { latestKg: number; averageKg: number | null; ratePerWeekKg: number | null } | null;
}

export function HomeView({ data }: { data: HomeData }) {
  return (
    <main className="flex-1 px-5 pb-6 pt-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <HomeHeader data={data} />
        <WeekStrip data={data} />
        <NextWorkoutCard next={data.next} timeZone={data.timeZone} />
        <WeekStats stats={data.weekStats} />
        {data.insight && <InsightCard insight={data.insight} />}
        <RecentRecords records={data.records} unit={data.unit} timeZone={data.timeZone} />
        {data.weight && <WeightTile weight={data.weight} unit={data.unit} />}
      </div>
    </main>
  );
}

function HomeHeader({ data }: { data: HomeData }) {
  const t = useTranslations('dashboard.home');
  return (
    <header className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-body font-semibold text-background"
      >
        {data.initials}
      </span>
      <h1 className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-caption text-muted-foreground">{t(`greeting.${data.greeting}`)}</span>
        <span className="truncate text-subtitle">{data.name}</span>
      </h1>
      <SyncStatus />
    </header>
  );
}

// Weekday label without the abbreviation dot, capitalized: "Seg", "Ter".
function shortWeekday(date: Date, locale: string): string {
  const raw = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    .format(date)
    .replace(/\.$/u, '');
  return raw.charAt(0).toLocaleUpperCase(locale) + raw.slice(1);
}

function WeekStrip({ data }: { data: HomeData }) {
  const t = useTranslations('dashboard.home');
  const locale = useLocale();
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: data.timeZone,
  }).format(data.now);
  const fullDay = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
  const dayNumber = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: 'UTC' });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="home-week-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-week-title" className="text-heading">
          {t('thisWeek')}
        </h2>
        <span className="text-caption text-muted-foreground">{today}</span>
      </div>
      <ol aria-label={t('weekLabel')} className="flex justify-between gap-1">
        {data.week.map((day) => {
          const isToday = day.status === 'today';
          return (
            <li
              key={day.key}
              aria-label={`${fullDay.format(day.date)}: ${t(`dayStatus.${day.status}`)}${
                isToday && day.trained ? `, ${t('dayStatus.trained')}` : ''
              }`}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex h-[88px] min-w-0 max-w-[46px] flex-1 flex-col items-center justify-between rounded-[23px] pb-1.5 pt-[9px]',
                isToday
                  ? 'bg-primary text-primary-foreground'
                  : day.status === 'planned'
                    ? 'border-[1.5px] border-brand/50 bg-card'
                    : 'border border-border bg-card',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'size-[5px] rounded-full',
                  isToday ? 'bg-primary-foreground' : day.trained ? 'bg-brand' : 'bg-transparent',
                )}
              />
              <span
                aria-hidden
                className={cn(
                  'text-small',
                  isToday ? 'text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {shortWeekday(day.date, locale)}
              </span>
              <span
                aria-hidden
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-caption font-semibold tabular-nums',
                  isToday
                    ? 'bg-primary-foreground text-primary'
                    : day.trained
                      ? 'bg-pill text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {dayNumber.format(day.date)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MetaItem({ icon: Glyph, children }: { icon: AppIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <Glyph className="size-4 text-muted-foreground" />
      {children}
    </span>
  );
}

function NextWorkoutCard({ next, timeZone }: { next: HomeNext; timeZone: string }) {
  const t = useTranslations('dashboard.home.next');
  const dashboardT = useTranslations('dashboard');
  const locale = useLocale();

  let tag: { text: string; tone: TagTone };
  let title: string;
  let meta: { icon: AppIcon; text: string }[] = [];
  let reason: string;
  let muscles: CompactMuscle[] | null = null;
  let cta: React.ReactNode;
  let secondary: { href: string; label: string } | null = null;

  switch (next.kind) {
    case 'inProgress': {
      const time = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).format(next.startedAt);
      tag = { text: t('inProgress', { minutes: next.elapsedMinutes }), tone: 'brand' };
      title = next.title;
      meta = [
        { icon: BarbellIcon, text: t('exercises', { count: next.exerciseCount }) },
        { icon: StackIcon, text: t('setsDone', { done: next.setsDone, total: next.setsTotal }) },
      ];
      reason = t('startedAt', { time });
      muscles = next.muscles;
      cta = (
        <Button asChild className="w-full">
          <Link href={`/session/${next.sessionId}`}>
            <PlayIcon />
            {t('resume')}
          </Link>
        </Button>
      );
      break;
    }
    case 'next':
      tag = next.tag;
      title = next.title;
      meta = [
        { icon: BarbellIcon, text: t('exercises', { count: next.exerciseCount }) },
        { icon: StackIcon, text: t('sets', { count: next.setCount }) },
        ...(next.minutes != null
          ? [{ icon: ClockIcon, text: t('minutes', { count: next.minutes }) }]
          : []),
      ];
      reason = next.reason;
      muscles = next.muscles;
      cta = <StartWorkoutButton workoutId={next.workoutId} label={t('start')} />;
      secondary = { href: '/session/new', label: t('chooseOther') };
      break;
    case 'choose':
      tag = { text: next.programName, tone: 'brand' };
      title = t('chooseTitle');
      reason = dashboardT('chooseSession');
      cta = (
        <Button asChild className="w-full">
          <Link href="/session/new">
            <PlayIcon />
            {dashboardT('chooseSession')}
          </Link>
        </Button>
      );
      break;
    case 'empty':
      tag = { text: t('emptyTag'), tone: 'warning' };
      title = next.programName;
      reason = next.reason;
      cta = (
        <Button asChild className="w-full">
          <Link href={`/programs/${next.programId}`}>
            <ListChecksIcon />
            {dashboardT('configureProgram')}
          </Link>
        </Button>
      );
      break;
    case 'noProgram':
      tag = { text: t('noProgramTag'), tone: 'warning' };
      title = t('noProgramTitle');
      meta = [{ icon: FilesIcon, text: t('noProgramMeta') }];
      reason = t('noProgramReason');
      cta = (
        <Button asChild className="w-full">
          <Link href="/programs/new/template">
            <ListChecksIcon />
            {t('chooseProgram')}
          </Link>
        </Button>
      );
      secondary = { href: '/programs/new', label: t('createProgram') };
      break;
    case 'new':
      tag = { text: t('newTag'), tone: 'brand' };
      title = dashboardT('onboardingTitle');
      meta = [
        { icon: ListNumbersIcon, text: t('newSteps') },
        { icon: TargetIcon, text: t('newTopics') },
      ];
      reason = t('newReason');
      cta = (
        <Button asChild className="w-full">
          <Link href="/onboarding">
            <ArrowRightIcon />
            {t('newCta')}
          </Link>
        </Button>
      );
      secondary = { href: '/exercises', label: t('explore') };
      break;
  }

  return (
    <section
      data-testid="next-workout"
      aria-labelledby="home-next-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pl-1 pt-1">
          <Tag dot={tag.tone}>{tag.text}</Tag>
          <h2 id="home-next-title" className="text-title [text-wrap:pretty]">
            {title}
          </h2>
          {meta.length > 0 && (
            <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 text-caption text-muted-foreground">
              {meta.map((item) => (
                <MetaItem key={item.text} icon={item.icon}>
                  {item.text}
                </MetaItem>
              ))}
            </div>
          )}
          <p className="flex items-center gap-1.5 text-caption">
            <CalendarCheckIcon className="size-4 shrink-0 text-brand" />
            {reason}
          </p>
        </div>
        {muscles && muscles.length > 0 && (
          <MuscleMap active={muscles} size={104} className="self-center" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        {cta}
        {secondary && (
          <Link
            href={secondary.href}
            className="flex h-11 items-center justify-center rounded-pill text-caption text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}

function WeekStats({ stats }: { stats: HomeData['weekStats'] }) {
  const t = useTranslations('dashboard.home.week');
  const ratio = (done: number, planned: number | null) =>
    planned != null && planned > 0 ? done / planned : undefined;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="home-stats-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-stats-title" className="text-heading">
          {t('title')}
        </h2>
        <Link
          href="/progress/report"
          className="rounded-pill text-caption text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('report')}
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3" data-testid="weekly-adherence">
        <StatTile
          label={t('sessions')}
          icon={BarbellIcon}
          value={String(stats.sessionsDone)}
          caption={
            stats.sessionsPlanned != null
              ? t('sessionsOf', { count: stats.sessionsPlanned })
              : t('thisWeek')
          }
          progress={ratio(stats.sessionsDone, stats.sessionsPlanned)}
        />
        <StatTile
          label={t('sets')}
          icon={StackIcon}
          value={String(stats.setsDone)}
          caption={
            stats.setsPrescribed != null
              ? t('setsOf', { count: stats.setsPrescribed })
              : t('thisWeek')
          }
          progress={ratio(stats.setsDone, stats.setsPrescribed)}
        />
      </div>
    </section>
  );
}

const INSIGHT_LOOK: Record<
  HomeInsightKind,
  { icon: AppIcon; tone: 'warning' | 'info' | 'deload' | 'pr' }
> = {
  stall: { icon: PauseIcon, tone: 'warning' },
  deload: { icon: BatteryLowIcon, tone: 'deload' },
  pr: { icon: TrophyIcon, tone: 'pr' },
  'on-track': { icon: TrendUpIcon, tone: 'info' },
};

// One insight computed by the domain (lib/home-insight): no AI sphere here.
function InsightCard({ insight }: { insight: NonNullable<HomeData['insight']> }) {
  const look = INSIGHT_LOOK[insight.kind];
  return (
    <Link
      href={insight.href}
      className="flex items-start gap-3 rounded border border-border bg-card p-4 transition-colors hover:bg-pill/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <IconCircle tone={look.tone}>
        <look.icon />
      </IconCircle>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-body font-semibold">{insight.title}</span>
        <span className="text-caption text-muted-foreground [text-wrap:pretty]">
          {insight.detail}
        </span>
      </span>
    </Link>
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
  const number = (kg: number) =>
    formatWeight(kg, unit, { decimals: 1, locale, withUnit: false });
  const withUnit = (kg: number) => formatWeight(kg, unit, { decimals: 1, locale });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="home-records-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-records-title" className="text-heading">
          {t('records.title')}
        </h2>
        <Link
          href="/progress"
          className="rounded-pill text-caption text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('home.records.viewAll')}
        </Link>
      </div>
      <div data-testid="recent-records" className="rounded border border-border bg-card px-4 py-1">
        {records.map((record) => {
          const date = format.dateTime(record.achievedAt, {
            day: '2-digit',
            month: '2-digit',
            timeZone,
          });
          const reps = record.type === 'REPS';
          const subtitle = reps
            ? `${withUnit(record.weightKg ?? 0)} · ${date}`
            : `${t(`home.records.${RECORD_LABEL_KEYS[record.type]}`)} · ${date}`;
          return (
            <ListRow
              key={record.id}
              leading={
                <IconCircle tone="pr">
                  <TrophyIcon />
                </IconCircle>
              }
              title={record.exerciseName ?? t(`home.records.${RECORD_LABEL_KEYS[record.type]}`)}
              subtitle={subtitle}
              trailing={
                <span className="flex shrink-0 items-baseline gap-1 tabular-nums">
                  <span className="text-caption text-muted-foreground">
                    {reps ? `× ${record.previousValue}` : number(record.previousValue)}
                  </span>
                  <span aria-hidden className="text-caption text-muted-foreground">
                    →
                  </span>
                  <span className="text-subtitle">
                    {reps ? `× ${record.value}` : withUnit(record.value)}
                  </span>
                </span>
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function WeightTile({
  weight,
  unit,
}: {
  weight: NonNullable<HomeData['weight']>;
  unit: WeightUnit;
}) {
  const t = useTranslations('dashboard.home.weight');
  const locale = useLocale();
  const value = formatWeight(weight.latestKg, unit, { decimals: 1, fixed: true, locale, withUnit: false });
  const parts = [
    weight.averageKg != null
      ? t('average', { value: formatWeight(weight.averageKg, unit, { decimals: 1, fixed: true, locale }) })
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
  return (
    <Link
      href="/progress"
      data-testid="home-weight"
      className="flex flex-col gap-3 rounded border border-border bg-card p-4 transition-colors hover:bg-pill/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between text-caption text-muted-foreground">
        {t('title')}
        <ScalesIcon className="size-[18px] text-brand" />
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-number tabular-nums">{value}</span>
        <span className="text-caption text-muted-foreground">{unit === 'LB' ? 'lb' : 'kg'}</span>
      </span>
      {parts.length > 0 && (
        <span className="text-caption text-muted-foreground tabular-nums">{parts.join(' · ')}</span>
      )}
    </Link>
  );
}
