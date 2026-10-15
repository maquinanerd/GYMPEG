import Link from 'next/link';
import { cn } from '@/lib/utils';

// Segmented control for a small in-page choice (unit, view): a row of 44px
// segments at radius 8 inside an input hairline; the chosen one is ink.
// Sections that are separate routes use the underlined tabs (ui/tabs).

const TRACK = 'flex w-full gap-1 rounded-md border border-input p-1';
const SEGMENT =
  'flex min-h-touch flex-1 items-center justify-center rounded-sm px-3 text-caption font-semibold transition-colors duration-[120ms] ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ACTIVE = 'bg-ink text-ink-foreground';
const INACTIVE = 'text-muted-foreground hover:text-foreground';

export interface SegmentedLinkItem {
  href: string;
  label: string;
  active: boolean;
}

export function SegmentedLinks({
  items,
  label,
  className,
}: {
  items: SegmentedLinkItem[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(TRACK, className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cn(SEGMENT, item.active ? ACTIVE : INACTIVE)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn(TRACK, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(SEGMENT, option.value === value ? ACTIVE : INACTIVE)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
