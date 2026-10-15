'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { CaretLeftIcon, CaretRightIcon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/button';
import { Num } from '@/components/ui/num';
import { textLinkClass } from '@/components/ui/section';
import { DayCell, DayLegend, type DayCellState } from '@/components/ui/week-strip';
import { cn } from '@/lib/utils';
import {
  buildMonthGrid,
  dateKeyInTimeZone,
  formatMonthKey,
  isDateKey,
  parseMonthKey,
  shiftCalendarMonth,
} from '@/lib/history-calendar';
import {
  hasHistoryFilters,
  setHistoryFilterParams,
  type HistoryFilterValues,
} from '@/lib/history-filters';

export interface HistoryCalendarSession {
  id: string;
  startedAt: string;
  title: string;
  programName: string | null;
  workingSets: number;
  volumeLabel: string | null;
  durationLabel: string | null;
  cardioDistanceLabel: string | null;
  cardioDurationLabel: string | null;
  cardioHeartRateLabel: string | null;
}

// The weekdays a fixed-days program schedules (ISO, 1 = Monday) and the first
// day it applies ('YYYY-MM-DD'): a past planned day without a session reads
// "planned, not done". Null for a rotation, or while filters narrow the list.
export interface HistoryPlannedDays {
  weekdays: number[];
  since: string;
}

interface Props {
  monthKey: string;
  initialDay?: string;
  sessions: HistoryCalendarSession[];
  filters?: HistoryFilterValues;
  timeZone: string;
  planned?: HistoryPlannedDays | null;
  // The filter chips, drawn between the month and the sessions list.
  filtersSlot?: React.ReactNode;
}

export function HistoryCalendar({
  monthKey,
  initialDay,
  sessions,
  filters = {},
  timeZone,
  planned = null,
  filtersSlot,
}: Props) {
  const t = useTranslations('history.calendar');
  const history = useTranslations('history');
  const common = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const month = useMemo(() => parseMonthKey(monthKey), [monthKey]);
  const weekStartsOn: 0 | 1 = MONDAY_FIRST_LOCALES.some((prefix) =>
    locale.toLowerCase().startsWith(prefix),
  )
    ? 1
    : 0;
  const cells = useMemo(() => buildMonthGrid(month, weekStartsOn), [month, weekStartsOn]);
  const todayKey = dateKeyInTimeZone(new Date(), timeZone);

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, HistoryCalendarSession[]>();
    for (const session of sessions) {
      const dateKey = dateKeyInTimeZone(session.startedAt, timeZone);
      if (!dateKey.startsWith(`${monthKey}-`)) continue;
      const daySessions = grouped.get(dateKey) ?? [];
      daySessions.push(session);
      grouped.set(dateKey, daySessions);
    }
    for (const daySessions of grouped.values()) {
      daySessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    }
    return grouped;
  }, [monthKey, sessions, timeZone]);

  // A day picked in the URL narrows the list to it; otherwise the list shows
  // the whole month, newest first.
  const defaultDate = useMemo(
    () => (isDateKey(initialDay) && initialDay.startsWith(`${monthKey}-`) ? initialDay : null),
    [initialDay, monthKey],
  );

  const [selectedDate, setSelectedDate] = useState<string | null>(defaultDate);

  useEffect(() => {
    setSelectedDate(defaultDate);
  }, [defaultDate]);

  // The server buckets days in whatever zone the URL carries (falling back to
  // its own). On the first paint the URL has none, so hand the browser zone
  // over once; the page re-renders with the lifter's days.
  useEffect(() => {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserZone || search.get('tz') === browserZone) return;
    const params = new URLSearchParams(search.toString());
    params.set('tz', browserZone);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, search]);

  // URLs carry the zone the current URL already has (the browser zone once
  // the effect above ran), never the server-resolved one, so the two cannot
  // diverge and trigger a replace on every navigation.
  const urlZone = search.get('tz') ?? timeZone;
  const monthSessions = useMemo(
    () =>
      [...sessionsByDate.values()].flat().sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessionsByDate],
  );
  const listed = selectedDate ? (sessionsByDate.get(selectedDate) ?? []) : monthSessions;
  // Calendar labels are pure dates: build them at UTC noon and format them in
  // UTC, so they never shift with the browser or server zone.
  const weekdayLabels = useMemo(() => {
    const sunday = Date.UTC(2024, 0, 7, 12);
    return Array.from({ length: 7 }, (_, index) => {
      const dayOffset = (weekStartsOn + index) % 7;
      const date = new Date(sunday + dayOffset * 86_400_000);
      return {
        short: format.dateTime(date, { weekday: 'narrow', timeZone: 'UTC' }),
        long: format.dateTime(date, { weekday: 'long', timeZone: 'UTC' }),
      };
    });
  }, [format, weekStartsOn]);

  const monthLabel = format.dateTime(new Date(Date.UTC(month.year, month.monthIndex, 1, 12)), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const filteredEmpty = hasHistoryFilters(filters) && sessionsByDate.size === 0;
  const isCurrentMonth = todayKey.startsWith(`${monthKey}-`);
  const plannedWeekdays = useMemo(() => new Set(planned?.weekdays ?? []), [planned]);

  function dayState(dateKey: string, trained: boolean): DayCellState | 'missed' {
    if (trained) return 'done';
    if (dateKey === todayKey) return 'today';
    if (
      planned &&
      dateKey < todayKey &&
      dateKey >= planned.since &&
      plannedWeekdays.has(isoWeekday(dateKey))
    ) {
      return 'missed';
    }
    return 'rest';
  }

  function navigateToMonth(delta: number) {
    const target = shiftCalendarMonth(month, delta);
    updateLocation(formatMonthKey(target), undefined);
  }

  function goToToday() {
    updateLocation(todayKey.slice(0, 7), todayKey);
  }

  function updateLocation(nextMonth: string, day: string | undefined) {
    const params = new URLSearchParams(search.toString());
    params.set('month', nextMonth);
    if (day) params.set('day', day);
    else params.delete('day');
    setHistoryFilterParams(params, filters);
    params.set('tz', urlZone);
    const href = `${pathname}?${params.toString()}`;
    startTransition(() => router.push(href));
  }

  function selectDay(dateKey: string | null) {
    setSelectedDate(dateKey);
    const params = new URLSearchParams(window.location.search);
    if (dateKey) params.set('day', dateKey);
    else params.delete('day');
    if (!params.has('tz')) params.set('tz', urlZone);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  }

  const returnParams = (session: HistoryCalendarSession) => {
    const params = setHistoryFilterParams(
      new URLSearchParams({
        month: monthKey,
        day: selectedDate ?? dateKeyInTimeZone(session.startedAt, timeZone),
      }),
      filters,
    );
    params.set('tz', urlZone);
    return params.toString();
  };

  return (
    <div className="flex flex-col gap-5" aria-busy={isPending}>
      <section
        aria-labelledby="history-month-heading"
        className={cn(
          'flex flex-col gap-2.5 transition-opacity duration-[120ms] ease-out-quart',
          isPending && 'opacity-60',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="history-month-heading" className="text-heading first-letter:uppercase">
            {monthLabel}
          </h2>
          <div className="-mr-3 flex items-center">
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={goToToday}
                disabled={isPending}
                className={cn(textLinkClass, 'mr-1 flex min-h-touch items-center px-2')}
              >
                {t('today')}
              </button>
            )}
            <IconButton
              type="button"
              size="sm"
              onClick={() => navigateToMonth(-1)}
              disabled={isPending}
              aria-label={t('previousMonth')}
            >
              <CaretLeftIcon className="!size-[18px]" />
            </IconButton>
            <IconButton
              type="button"
              size="sm"
              onClick={() => navigateToMonth(1)}
              disabled={isPending}
              aria-label={t('nextMonth')}
            >
              <CaretRightIcon className="!size-[18px]" />
            </IconButton>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1" aria-hidden>
          {weekdayLabels.map((label, index) => (
            <abbr
              key={`${label.long}-${index}`}
              title={label.long}
              className="text-center text-small font-semibold uppercase text-muted-foreground no-underline"
            >
              {label.short}
            </abbr>
          ))}
        </div>
        <ol className="grid grid-cols-7 gap-1" aria-label={monthLabel}>
          {cells.map((cell, index) => {
            if (!cell.dateKey || !cell.dayNumber) {
              return <li key={`blank-${index}`} aria-hidden className="h-10" />;
            }
            const dateKey = cell.dateKey;
            const daySessions = sessionsByDate.get(dateKey) ?? [];
            const state = dayState(dateKey, daySessions.length > 0);
            const isSelected = dateKey === selectedDate;
            const dateLabel = format.dateTime(dateKeyToUtcDate(dateKey), {
              ...DATE_LABEL_FORMAT,
            });
            const accessibleLabel = [
              dateLabel,
              daySessions.length > 0 ? t('workoutCount', { count: daySessions.length }) : null,
              state === 'missed' ? t('missed') : null,
              dateKey === todayKey ? t('today') : null,
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <li key={dateKey} className="flex">
                <button
                  type="button"
                  aria-label={accessibleLabel}
                  aria-pressed={isSelected}
                  onClick={() => selectDay(isSelected ? null : dateKey)}
                  className="w-full rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <DayCell
                    aria-hidden
                    state={state === 'missed' ? 'planned' : state}
                    className={cn(
                      'h-10 stretch-108',
                      // Past days read in ink, days still to come muted.
                      state === 'rest' && dateKey < todayKey && 'text-foreground',
                      isSelected && 'ring-2 ring-ink ring-offset-2 ring-offset-background',
                    )}
                  >
                    {cell.dayNumber}
                  </DayCell>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-small text-muted-foreground">
          <DayLegend state="done">{t('legend.done')}</DayLegend>
          {planned && <DayLegend state="planned">{t('legend.missed')}</DayLegend>}
          <DayLegend state="today">{t('legend.today')}</DayLegend>
        </div>
      </section>

      {/* A server-rendered slot: wrapped so React does not read it as an
          unkeyed child of this list of siblings. */}
      <div>{filtersSlot}</div>

      <section aria-labelledby="history-list-heading" className="flex flex-col">
        {selectedDate ? (
          <div className="flex items-baseline justify-between gap-3 pb-2">
            <h2 id="history-list-heading" className="text-subtitle first-letter:uppercase">
              {format.dateTime(dateKeyToUtcDate(selectedDate), { ...DATE_LABEL_FORMAT })}
            </h2>
            <button
              type="button"
              onClick={() => selectDay(null)}
              className={cn(textLinkClass, 'shrink-0')}
            >
              {t('wholeMonth')}
            </button>
          </div>
        ) : (
          <h2 id="history-list-heading" className="sr-only">
            {t('monthSessions', { month: monthLabel })}
          </h2>
        )}

        {filteredEmpty ? (
          <p className="border-t border-border py-4 text-caption text-muted-foreground">
            {history('noFiltered')}
          </p>
        ) : listed.length === 0 ? (
          <p className="border-t border-border py-4 text-caption text-muted-foreground">
            {selectedDate ? t('noSessions') : t('noSessionsMonth')}
          </p>
        ) : (
          <ul>
            {listed.map((session) => {
              const started = new Date(session.startedAt);
              const lead = selectedDate
                ? format.dateTime(started, { hour: '2-digit', minute: '2-digit', timeZone })
                : format.dateTime(started, { weekday: 'short', day: '2-digit', timeZone });
              const meta = session.cardioDurationLabel
                ? [
                    session.cardioDistanceLabel,
                    session.cardioDurationLabel,
                    session.cardioHeartRateLabel,
                    session.programName,
                  ]
                : [
                    session.durationLabel,
                    common('counts.sets', { count: session.workingSets }),
                    session.programName,
                  ];
              return (
                <li key={session.id} className="border-t border-border">
                  <Link
                    href={`/history/${session.id}?${returnParams(session)}`}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-1 py-3.5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="text-[0.8125rem] font-semibold text-muted-foreground">
                      {lead}
                    </span>
                    <span className="text-body font-semibold">{session.title}</span>
                    <span className="text-right">
                      {session.volumeLabel && (
                        <Num stretch={108} className="text-caption">
                          {session.volumeLabel}
                        </Num>
                      )}
                    </span>
                    <span className="col-start-2 col-end-[-1] text-[0.8125rem] font-medium text-muted-foreground">
                      {meta.filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// English starts the week on Sunday (the US convention). pt-BR follows the
// design v2 mocks and the home week strip, Monday to Sunday, so the month
// and the week read the same way.
const MONDAY_FIRST_LOCALES = ['ru', 'fr', 'pt'];
const DATE_LABEL_FORMAT = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
} as const;

function dateKeyToUtcDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return new Date(Date.UTC(year, month - 1, day, 12));
}

// ISO weekday (1 = Monday ... 7 = Sunday) of a calendar date key.
function isoWeekday(dateKey: string): number {
  const day = dateKeyToUtcDate(dateKey).getUTCDay();
  return day === 0 ? 7 : day;
}
