import { cn } from '@/lib/utils';
import type { AppIcon } from '@/components/ui/icon';

// Progress ring: a 6px stroke on the track token, filled clockwise from the
// top. The fill is heat-2, the map's "in range" lime: #CCFF00 itself is too
// faint on a white card for a thin ring (heat-2 is #CCFF00 in dark).
export function ProgressRing({
  value,
  size = 52,
  className,
}: {
  // 0..1, clamped.
  value: number;
  size?: number;
  className?: string;
}) {
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <circle cx={28} cy={28} r={radius} fill="none" strokeWidth={6} className="stroke-track" />
      {ratio > 0 && (
        <circle
          cx={28}
          cy={28}
          r={radius}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${(ratio * circumference).toFixed(1)} ${circumference.toFixed(1)}`}
          transform="rotate(-90 28 28)"
          className="stroke-heat-2"
        />
      )}
    </svg>
  );
}

// Stat tile: label + brand icon on top, a big tabular number with its caption
// at the bottom left and an optional progress ring at the bottom right.
export function StatTile({
  label,
  icon: Glyph,
  value,
  unit,
  caption,
  progress,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: string;
  icon?: AppIcon;
  value: string;
  unit?: string;
  caption?: string;
  // 0..1: draws the ring; omitted for a plain number.
  progress?: number;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3.5 rounded border border-border bg-card p-4',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
        <span className="truncate">{label}</span>
        {Glyph && <Glyph className="size-[18px] shrink-0 text-brand" />}
      </div>
      <div className="flex items-end justify-between gap-1">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-baseline gap-1">
            <span className="text-number tabular-nums">{value}</span>
            {unit && <span className="text-caption text-muted-foreground">{unit}</span>}
          </span>
          {caption && (
            <span className="mt-1 whitespace-nowrap text-small text-muted-foreground">{caption}</span>
          )}
        </div>
        {progress != null && <ProgressRing value={progress} size={46} />}
      </div>
    </div>
  );
}
