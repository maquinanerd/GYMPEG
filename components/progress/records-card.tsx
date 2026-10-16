import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { WeightUnit } from '@/lib/prisma-client';
import { formatWeight } from '@/lib/units';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { EmptyState } from '@/components/ui/empty-state';
import { Highlight } from '@/components/ui/highlight';
import { ListRow } from '@/components/ui/list-row';
import { Num } from '@/components/ui/num';

// One exercise's all-time bests, serialized at the Server Component boundary.
// Weights are stored in kg (bodyweight-effective load already applied upstream)
// and formatted into the user's unit here. Dates are ISO day strings.
export interface ExerciseRecordView {
  exerciseName: string;
  maxWeight: number;
  maxWeightReps: number;
  maxWeightDate: string;
  bestE1RM: number;
  bestE1RMDate: string;
}

interface Props {
  records: ExerciseRecordView[];
  unit: WeightUnit;
  // Today in the user's zone (YYYY-MM-DD), to tell recent records apart.
  today: string;
}

// A record set within this many days is "recent": the yellow marker. Older
// ones keep a muted marker so the column still reads as records.
export const RECENT_RECORD_DAYS = 30;

const DAY_MS = 86_400_000;
const dayValue = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);

// Records board (issue #190, Recordes tab, display-only): per strength
// exercise the best estimated 1RM and the heaviest working set ever, each with
// the date it was reached. Pure derivation from existing set history (lib/
// records exerciseRecords); cardio and warm-ups are excluded upstream. Newest
// records first.
export function RecordsCard({ records, unit, today }: Props) {
  const t = useTranslations('progress.records');
  const locale = useLocale();
  const format = useFormatter();
  const formatDay = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00.000Z`), {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      timeZone: 'UTC',
    });

  if (records.length === 0) {
    return (
      <EmptyState
        title={t('empty')}
        description={t('emptyDescription')}
        action={{ label: t('emptyAction'), href: '/session/new' }}
      />
    );
  }

  const latest = (r: ExerciseRecordView) =>
    Math.max(dayValue(r.bestE1RMDate), dayValue(r.maxWeightDate));
  const sorted = [...records].sort((a, b) => latest(b) - latest(a));
  const cutoff = dayValue(today) - RECENT_RECORD_DAYS * DAY_MS;

  return (
    <div className="flex flex-col gap-4">
      <ul>
        {sorted.map((r) => {
          const recent = dayValue(r.bestE1RMDate) >= cutoff;
          const value = formatWeight(r.bestE1RM, unit, { locale });
          return (
            <ListRow
              key={r.exerciseName}
              className="first:border-t-0"
              contentClassName="py-3.5"
              title={getExerciseDisplayName(r.exerciseName, locale)}
              meta={
                <>
                  <span className="block">{t('oneRm', { date: formatDay(r.bestE1RMDate) })}</span>
                  <span className="block">
                    {t('heaviest', {
                      value: `${formatWeight(r.maxWeight, unit, { locale })} × ${r.maxWeightReps}`,
                      date: formatDay(r.maxWeightDate),
                    })}
                  </span>
                </>
              }
              trailing={
                recent ? (
                  <Highlight className="text-body">
                    {value}
                    <span className="sr-only"> ({t('recent')})</span>
                  </Highlight>
                ) : (
                  <Num
                    stretch={118}
                    className="inline-block rounded-xs bg-muted px-1.5 py-0.5 text-body"
                  >
                    {value}
                  </Num>
                )
              }
            />
          );
        })}
      </ul>
      <p className="text-small text-muted-foreground text-pretty">
        {t('description', { days: RECENT_RECORD_DAYS })}
      </p>
    </div>
  );
}
