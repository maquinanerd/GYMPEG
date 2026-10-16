import { cn } from '@/lib/utils';

// One day of the week strip or of the month calendar, radius 6:
// - done: ink fill, white number;
// - today: lime fill with an ink outline;
// - planned (or planned and missed): dashed outline;
// - rest / future / outside: plain number, muted.
// The state is in the accessible label too, never in color alone.
export type DayCellState = 'done' | 'today' | 'planned' | 'rest';

export function DayCell({
  state,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { state: DayCellState }) {
  return (
    <span
      className={cn(
        'flex w-full items-center justify-center rounded-[6px] border-[1.5px] font-num text-caption font-semibold tabular-nums stretch-112',
        state === 'done' && 'border-transparent bg-ink text-ink-foreground',
        state === 'today' && 'border-ink bg-primary text-primary-foreground',
        state === 'planned' && 'border-dashed border-subtle text-foreground',
        state === 'rest' && 'border-transparent text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export interface WeekStripItem {
  key: string;
  // Short weekday ("seg").
  weekday: string;
  // Day of the month ("15").
  day: string;
  state: DayCellState;
  // Full sentence for assistive tech ("qui 15: hoje, planejado").
  label: string;
}

// The 7 days of this week as a row of 38px cells under their weekday.
export function WeekStrip({
  days,
  className,
}: {
  days: WeekStripItem[];
  className?: string;
}) {
  return (
    <ol className={cn('grid grid-cols-7 gap-1.5', className)}>
      {days.map((day) => (
        <li key={day.key} aria-label={day.label} className="flex flex-col items-center gap-1.5">
          <span aria-hidden className="text-small text-muted-foreground">
            {day.weekday}
          </span>
          <DayCell aria-hidden state={day.state} className="h-[38px]">
            {day.day}
          </DayCell>
        </li>
      ))}
    </ol>
  );
}

// Legend swatch for the calendar (10px, radius 2).
export function DayLegend({ state, children }: { state: DayCellState; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          'size-2.5 rounded-[2px] border-[1.5px]',
          state === 'done' && 'border-transparent bg-ink',
          state === 'today' && 'border-ink bg-primary',
          state === 'planned' && 'border-dashed border-subtle',
          state === 'rest' && 'border-transparent bg-track',
        )}
      />
      {children}
    </span>
  );
}
