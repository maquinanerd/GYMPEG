import Link from 'next/link';
import { cn } from '@/lib/utils';

// Segmented control: a pill track (bg-pill) with one raised segment. Two
// flavours share the look: links, for sections that are separate routes
// (Treinos, Coach), and buttons, for an in-page choice.

const TRACK = 'flex w-full gap-1 rounded-pill bg-pill p-1';
const SEGMENT =
  'flex min-h-11 flex-1 items-center justify-center rounded-pill px-3 text-caption transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ACTIVE = 'bg-card font-semibold text-foreground shadow-sm';
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
