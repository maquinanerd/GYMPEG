import { cn } from '@/lib/utils';

// One column per week, oldest first: ink bars on the page background, no
// grid, no gradient. A dashed reference line (a weekly target) may run across.
// The whole strip is one image for assistive tech; the caller writes the
// summary in `label` and keeps the numbers in text next to it.

export type WeekBarTone = 'ink' | 'faint';

const TONE: Record<WeekBarTone, string> = {
  ink: 'bg-ink',
  // Weeks that miss the rule (off a streak): the input grey, not a color.
  faint: 'bg-input',
};

export function WeekBars({
  values,
  tones,
  reference,
  label,
  startLabel,
  endLabel,
  className,
}: {
  values: number[];
  // Per-bar tone; ink when omitted.
  tones?: WeekBarTone[];
  // Value drawn as the dashed line (e.g. 150 min of cardio a week).
  reference?: number;
  label: string;
  startLabel?: string;
  endLabel?: string;
  className?: string;
}) {
  const max = Math.max(1, reference ?? 0, ...values) * 1.1;
  const pct = (value: number) => `${((value / max) * 100).toFixed(1)}%`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div role="img" aria-label={label} className="relative flex h-16 items-end gap-1">
        {values.map((value, index) => (
          <span
            key={index}
            aria-hidden
            className={cn(
              'flex-1 rounded-t-[2px]',
              value > 0 ? TONE[tones?.[index] ?? 'ink'] : 'bg-track',
            )}
            // An empty week keeps a 2px stub so the strip reads as weeks.
            style={{ height: value > 0 ? pct(value) : '2px' }}
          />
        ))}
        {reference != null && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-subtle"
            style={{ bottom: pct(reference) }}
          />
        )}
      </div>
      {(startLabel || endLabel) && (
        <div
          aria-hidden
          className="flex justify-between text-[11px] font-medium text-muted-foreground"
        >
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}
