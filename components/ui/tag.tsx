import { cn } from '@/lib/utils';
import type { AppIcon } from '@/components/ui/icon';

// Tag: a 28px pill. Two looks:
// - neutral (bg-pill) with a colored dot that carries the meaning (cycle week,
//   deload, readiness);
// - filled with an accent (PR yellow, deload lavender…), always with #111 text
//   on top, for the few states that must stand out.

export type TagTone = 'brand' | 'pr' | 'info' | 'warmup' | 'deload' | 'warning' | 'destructive';

const DOT: Record<TagTone, string> = {
  brand: 'bg-brand',
  pr: 'bg-pr',
  info: 'bg-info',
  warmup: 'bg-warmup',
  deload: 'bg-deload',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

const FILL: Record<TagTone, string> = {
  brand: 'bg-primary text-primary-foreground',
  pr: 'bg-pr text-pr-foreground',
  info: 'bg-info text-info-foreground',
  warmup: 'bg-warmup text-warmup-foreground',
  deload: 'bg-deload text-deload-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

export function Tag({
  children,
  dot,
  fill,
  icon: Glyph,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  // Neutral pill with a dot of this tone.
  dot?: TagTone;
  // Filled pill in this tone (wins over `dot`).
  fill?: TagTone;
  icon?: AppIcon;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-pill px-3 text-small',
        fill ? cn(FILL[fill], 'font-semibold') : 'bg-pill text-foreground',
        className,
      )}
      {...props}
    >
      {!fill && dot && <span aria-hidden className={cn('size-1.5 rounded-full', DOT[dot])} />}
      {Glyph && <Glyph className="size-3.5" />}
      {children}
    </span>
  );
}
