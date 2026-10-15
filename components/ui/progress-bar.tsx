import { cn } from '@/lib/utils';

// Thin progress bar: 4px (6px with size="md") of track with an ink fill. Sits
// under a big number, in line; never a ring.
export function ProgressBar({
  value,
  max = 1,
  size = 'sm',
  label,
  className,
}: {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, Number.isFinite(value) ? value / safeMax : 0));
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(safeMax, Math.max(0, value))}
      className={cn(
        'flex w-full overflow-hidden bg-track',
        size === 'sm' ? 'h-1 rounded-[2px]' : 'h-1.5 rounded-[3px]',
        className,
      )}
    >
      <span className="bg-ink" style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
    </span>
  );
}
