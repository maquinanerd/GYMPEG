'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface WheelOption<T extends string | number> {
  value: T;
  label: string;
}

const ITEM_HEIGHT = 56;
const VISIBLE_ROWS = 5;

// Scroll wheel for a small set of values (RIR, reps, load). The centred row is
// the value: scrolling settles on a row (scroll-snap), a tap picks a row, the
// arrow keys step. A listbox for assistive tech; the scroll follows the value
// without animation when the user prefers reduced motion.
export function WheelPicker<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: WheelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  // True while a scroll was started by the user (not by following the value).
  const userScroll = useRef(false);
  const id = useId();
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  // Keep the selected row centred when the value changes from outside.
  useEffect(() => {
    const list = listRef.current;
    if (!list || userScroll.current) return;
    const top = index * ITEM_HEIGHT;
    if (Math.abs(list.scrollTop - top) > 1) {
      list.scrollTo?.({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, [index]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  function handleScroll() {
    if (!userScroll.current) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const list = listRef.current;
      userScroll.current = false;
      if (!list) return;
      const nearest = Math.min(
        options.length - 1,
        Math.max(0, Math.round(list.scrollTop / ITEM_HEIGHT)),
      );
      const option = options[nearest];
      if (option && option.value !== value) onChange(option.value);
    }, 90);
  }

  function step(delta: number) {
    const next = options[Math.min(options.length - 1, Math.max(0, index + delta))];
    if (next && next.value !== value) onChange(next.value);
  }

  const padding = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT;

  return (
    <div className={cn('relative', className)} style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}>
      {/* Selection band behind the centred row. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-sm bg-row-current"
        style={{ height: ITEM_HEIGHT }}
      />
      <div
        ref={listRef}
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={`${id}-${index}`}
        onPointerDown={() => (userScroll.current = true)}
        onWheel={() => (userScroll.current = true)}
        onTouchStart={() => (userScroll.current = true)}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            step(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            step(-1);
          }
        }}
        className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingTop: padding, paddingBottom: padding }}
      >
        {options.map((option, optionIndex) => {
          const selected = optionIndex === index;
          return (
            <div
              key={String(option.value)}
              id={`${id}-${optionIndex}`}
              role="option"
              aria-selected={selected}
              onClick={() => {
                userScroll.current = false;
                if (!selected) onChange(option.value);
              }}
              className={cn(
                'flex snap-center items-center justify-center font-num font-semibold tabular-nums stretch-118',
                selected ? 'text-[1.75rem] text-foreground' : 'text-subtitle text-muted-foreground',
              )}
              style={{ height: ITEM_HEIGHT }}
            >
              {option.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
