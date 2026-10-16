import * as React from 'react';
import { cn } from '@/lib/utils';

// Filter chip: 40px, radius 8, an input hairline; the selected one is ink
// (#111 fill, white text). A toggle, so it carries aria-pressed.
export const FilterChip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }
>(({ selected = false, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={selected}
    className={cn(
      'inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3.5 text-caption font-semibold transition-colors duration-[120ms] ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4',
      selected
        ? 'border-ink bg-ink text-ink-foreground'
        : 'border-input bg-transparent text-foreground hover:bg-muted',
      className,
    )}
    {...props}
  />
));
FilterChip.displayName = 'FilterChip';

/** @deprecated v1 name; use FilterChip. */
export const Chip = FilterChip;

// A horizontal, edge-to-edge scroller of chips (20px gutter kept inside).
export function ChipRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-none', className)}
      {...props}
    />
  );
}
