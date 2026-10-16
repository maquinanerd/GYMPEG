import { cn } from '@/lib/utils';
import type { AppIcon } from '@/components/ui/icon';

// Tag: a 24px label at radius 4, 12/600. A state in words, never an icon in a
// colored circle. Accents are always the fill with #111 on top.

export type TagVariant =
  | 'primary'
  | 'pr'
  | 'warmup'
  | 'deload'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'muted';

/** @deprecated v1 name; use TagVariant. */
export type TagTone = Exclude<TagVariant, 'muted'> | 'brand';

const FILL: Record<TagVariant, string> = {
  primary: 'bg-primary text-primary-foreground',
  pr: 'bg-pr text-pr-foreground',
  warmup: 'bg-warmup text-warmup-foreground',
  deload: 'bg-deload text-deload-foreground',
  warning: 'bg-warning text-warning-foreground',
  info: 'bg-info text-info-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  muted: 'bg-muted text-foreground',
};

export function Tag({
  children,
  variant,
  fill,
  dot: _dot,
  icon: Glyph,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: TagVariant;
  /** @deprecated v1 prop; use `variant`. */
  fill?: TagTone;
  /** @deprecated v1 prop: dots are gone, the tag reads muted. */
  dot?: TagTone;
  icon?: AppIcon;
}) {
  const resolved: TagVariant = variant ?? (fill === 'brand' ? 'primary' : (fill ?? 'muted'));
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-xs px-2 text-small font-semibold',
        FILL[resolved],
        className,
      )}
      {...props}
    >
      {Glyph && <Glyph weight="bold" className="size-3.5" />}
      {children}
    </span>
  );
}
