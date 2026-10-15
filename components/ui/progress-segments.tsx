import { cn } from '@/lib/utils';

// One 3px bar per step (exercises of a workout): done and current steps are
// ink, the rest is the track. The bar is a progressbar for assistive tech.
export function ProgressSegments({
  total,
  done,
  current,
  label,
  className,
}: {
  total: number;
  // Indexes of the completed steps.
  done: ReadonlySet<number> | readonly number[];
  // Index of the step on screen.
  current?: number;
  label: string;
  className?: string;
}) {
  const completed = done instanceof Set ? done : new Set(done as readonly number[]);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed.size}
      className={cn('flex gap-[3px]', className)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-[3px] flex-1 rounded-[2px]',
            completed.has(index) || index === current ? 'bg-ink' : 'bg-track',
          )}
        />
      ))}
    </div>
  );
}
