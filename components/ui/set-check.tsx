import * as React from 'react';
import { CheckIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// "Set done" toggle: the one round control of the app, 64px. Pending is a
// white disc with the input hairline and a faint check; done is the lime fill
// with an ink check. A toggle, so it carries aria-pressed.
export const SetCheck = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
    done: boolean;
    'aria-label': string;
  }
>(({ done, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={done}
    className={cn(
      'flex size-16 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[background-color,transform] duration-[120ms] ease-out-quart active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 motion-reduce:transition-none',
      done
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-input bg-card text-input hover:text-muted-foreground',
      className,
    )}
    {...props}
  >
    <CheckIcon className="size-[26px]" />
  </button>
));
SetCheck.displayName = 'SetCheck';

// One editable cell of the set sheet (kg, reps, RIR): a 48px button holding a
// widened number. On the current row it is a white field with the input
// hairline; elsewhere it is bare text (muted until the set is done).
export const SetCell = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'current' | 'done' | 'pending';
  }
>(({ tone = 'pending', className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      'h-12 w-full rounded-sm border font-num text-number tabular-nums stretch-118 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
      tone === 'current'
        ? 'border-input bg-card text-foreground'
        : 'border-transparent bg-transparent',
      tone === 'done' && 'text-foreground',
      tone === 'pending' && 'text-muted-foreground',
      className,
    )}
    {...props}
  />
));
SetCell.displayName = 'SetCell';
