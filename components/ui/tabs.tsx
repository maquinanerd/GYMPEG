import Link from 'next/link';
import { cn } from '@/lib/utils';

// Underlined tabs: 16px labels on a hairline, the selected one 600 with a 2px
// ink underline. Two flavours share the look: links, for sections that are
// separate routes (Treinos, Coach), and buttons, for an in-page switch
// (Evolução). Full width of the screen, 20px gutter.

const LIST =
  'flex shrink-0 gap-6 overflow-x-auto border-b border-border px-5 scrollbar-none';
const TAB =
  '-mb-px flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 text-body transition-colors duration-[120ms] ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
const ACTIVE = 'border-ink font-semibold text-foreground';
const INACTIVE = 'border-transparent text-muted-foreground hover:text-foreground';

export interface TabLinkItem {
  href: string;
  label: string;
  active: boolean;
}

export function TabLinks({
  items,
  label,
  className,
}: {
  items: TabLinkItem[];
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn(LIST, className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          role="tab"
          aria-selected={item.active}
          aria-current={item.active ? 'page' : undefined}
          className={cn(TAB, item.active ? ACTIVE : INACTIVE)}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
  idPrefix,
  className,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  // When set, each tab controls the panel `${idPrefix}-panel-${value}`.
  idPrefix?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn(LIST, className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${option.value}` : undefined}
            aria-selected={selected}
            aria-controls={idPrefix ? `${idPrefix}-panel-${option.value}` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const index = options.findIndex((o) => o.value === value);
              const step = event.key === 'ArrowRight' ? 1 : -1;
              const next = options[(index + step + options.length) % options.length];
              if (next) onChange(next.value);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]',
              );
              buttons?.[(index + step + options.length) % options.length]?.focus();
            }}
            className={cn(TAB, selected ? ACTIVE : INACTIVE)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
