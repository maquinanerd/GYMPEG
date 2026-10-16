import { useTranslations } from 'next-intl';
import { isDeloadWeek, type ProgramCycle } from '@/lib/program-cycle';
import { cn } from '@/lib/utils';

// Labels only fit under the cells up to this many weeks at 320px.
const MAX_LABELED_WEEKS = 6;

// The mesocycle as one 8px cell per week (lib/program-cycle): done weeks in
// ink, the current one lime with an ink outline, the ones to come on the
// track, the deload week lavender. The status sentence carries the meaning
// for assistive tech; the cells are decoration.
export function CycleBar({ cycle, week }: { cycle: ProgramCycle; week: number }) {
  const t = useTranslations('programs');
  const weeks = Array.from({ length: cycle.weeks }, (_, index) => index + 1);
  const columns = { gridTemplateColumns: `repeat(${cycle.weeks}, minmax(0, 1fr))` };
  const status = isDeloadWeek(cycle, week)
    ? t('cycle.statusDeload', { week, weeks: cycle.weeks })
    : t('cycle.status', { week, weeks: cycle.weeks });

  return (
    <div className="flex flex-col gap-1.5" data-testid="program-cycle-bar">
      <p className="sr-only">{status}</p>
      <div aria-hidden className="grid gap-1" style={columns}>
        {weeks.map((n) => (
          <span
            key={n}
            className={cn(
              'h-2 rounded-[2px]',
              n === week
                ? 'bg-primary outline outline-[1.5px] outline-offset-[-1.5px] outline-ink'
                : n < week
                  ? 'bg-ink'
                  : isDeloadWeek(cycle, n)
                    ? 'bg-deload'
                    : 'bg-track',
            )}
          />
        ))}
      </div>
      {cycle.weeks <= MAX_LABELED_WEEKS ? (
        <div aria-hidden className="grid gap-1 text-small text-muted-foreground" style={columns}>
          {weeks.map((n) => (
            <span key={n} className={cn('truncate', n === week && 'font-semibold text-foreground')}>
              {isDeloadWeek(cycle, n) ? t('list.deload') : t('list.weekShort', { week: n })}
            </span>
          ))}
        </div>
      ) : (
        <p aria-hidden className="text-small text-muted-foreground">
          {status}
        </p>
      )}
    </div>
  );
}
