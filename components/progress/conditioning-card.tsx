import { useFormatter, useTranslations } from 'next-intl';
import { WEEKLY_CONDITIONING_TARGET_MIN } from '@/lib/stats';
import { Num } from '@/components/ui/num';
import { WeekBars } from '@/components/progress/week-bars';

// One weekly conditioning point, serialized at the Server Component boundary.
export interface ConditioningWeekView {
  weekKey: string; // YYYY-Www
  weekStartIso: string; // Monday 00:00 UTC
  minutes: number;
  distanceKm: number;
  sessions: number;
}

interface Props {
  // Zero-filled window, oldest first (lib/stats weeklyConditioning).
  weeks: ConditioningWeekView[];
}

// Conditioning block (issue #135, display-only): weekly cardio minutes as ink
// bars against the WHO 150 min/week reference (dashed), then this week and
// the window total in words. The parent hides it entirely while the user has
// never logged a cardio set.
export function ConditioningCard({ weeks }: Props) {
  const t = useTranslations('progress.conditioning');
  const format = useFormatter();
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  const current = weeks[weeks.length - 1];
  const totalMinutes = weeks.reduce((acc, w) => acc + w.minutes, 0);
  const totalKm = +weeks.reduce((acc, w) => acc + w.distanceKm, 0).toFixed(2);

  // "45 min · 5.5 km · 1 session": distance only when there is some.
  const line = (minutes: number, km: number, sessions?: number) =>
    [
      t('minutes', { value: format.number(minutes) }),
      km > 0 ? t('distance', { value: format.number(km) }) : null,
      sessions != null ? t('sessions', { count: sessions }) : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-caption font-semibold">{t('title')}</h3>
      <WeekBars
        values={weeks.map((w) => w.minutes)}
        reference={WEEKLY_CONDITIONING_TARGET_MIN}
        label={t('aria', {
          count: weeks.length,
          list: weeks
            .map((w) => `${day(w.weekStartIso)} ${t('minutes', { value: w.minutes })}`)
            .join(', '),
        })}
        startLabel={weeks[0] ? day(weeks[0].weekStartIso) : undefined}
        endLabel={current ? day(current.weekStartIso) : undefined}
      />
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-small text-muted-foreground">{t('thisWeek')}</dt>
          <dd data-testid="conditioning-week">
            <Num stretch={112} className="text-caption">
              {line(current?.minutes ?? 0, current?.distanceKm ?? 0, current?.sessions ?? 0)}
            </Num>
          </dd>
        </div>
        <div>
          <dt className="text-small text-muted-foreground">{t('total', { weeks: weeks.length })}</dt>
          <dd data-testid="conditioning-total">
            <Num stretch={112} className="text-caption">
              {line(totalMinutes, totalKm)}
            </Num>
          </dd>
        </div>
      </dl>
      <p className="text-small text-muted-foreground">
        {t('description', { target: WEEKLY_CONDITIONING_TARGET_MIN })}
      </p>
    </div>
  );
}
