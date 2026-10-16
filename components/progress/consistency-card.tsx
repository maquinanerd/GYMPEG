import { useFormatter, useTranslations } from 'next-intl';
import type { ConsistencyWeek } from '@/lib/stats';
import { WeekBars } from '@/components/progress/week-bars';

interface Props {
  weeks: ConsistencyWeek[];
  currentStreak: number;
  weeklyFrequency: number | null;
}

// Read-only consistency block (Semana tab): the current streak and one bar of
// trained days per week over the window. Weeks that count for the streak are
// ink, the others the input grey; the numbers are in the strip's label.
export function ConsistencyCard({ weeks, currentStreak, weeklyFrequency }: Props) {
  const t = useTranslations('progress.consistency');
  const format = useFormatter();
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-caption font-semibold">{t('title')}</h3>
        <span className="text-caption font-semibold">{t('streak', { weeks: currentStreak })}</span>
      </div>
      <WeekBars
        values={weeks.map((w) => w.trainedDays)}
        tones={weeks.map((w) => (w.onStreak ? 'ink' : 'faint'))}
        label={t('aria', {
          list: weeks.map((w) => `${day(w.weekStartIso)} ${w.trainedDays}`).join(', '),
        })}
        startLabel={weeks[0] ? day(weeks[0].weekStartIso) : undefined}
        endLabel={weeks.at(-1) ? day(weeks.at(-1)!.weekStartIso) : undefined}
      />
      <p className="text-small text-muted-foreground">
        {t('description', { weeks: weeks.length, target: weeklyFrequency ?? 'none' })}
      </p>
    </div>
  );
}
