import { cn } from '@/lib/utils';

// One 4px bar per step (exercises of a workout): done and current steps are
// lime, the rest is the track. The bar is a progressbar for assistive tech.
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
      className={cn('flex gap-1', className)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors',
            completed.has(index) || index === current ? 'bg-primary' : 'bg-track',
          )}
        />
      ))}
    </div>
  );
}
