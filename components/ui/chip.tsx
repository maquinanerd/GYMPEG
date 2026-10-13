import * as React from 'react';
import { cn } from '@/lib/utils';

// Chip: a 48px pill to pick one item of a horizontal list (the exercise strip
// of the workout). The selected chip is the lime fill.
export const Chip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }
>(({ selected = false, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={selected}
    className={cn(
      'inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill px-4 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
      selected
        ? 'bg-primary text-primary-foreground'
        : 'bg-pill text-foreground hover:bg-secondary',
      className,
    )}
    {...props}
  />
));
Chip.displayName = 'Chip';
