import { useId } from 'react';
import { cn } from '@/lib/utils';

// A titled block of a screen: a 20/600 h2 (17/600 with size="sm"), an
// optional action on the right, then the content. No box: sections are split
// by a hairline and space (`divider`).
export function Section({
  title,
  action,
  aside,
  size = 'md',
  divider = false,
  className,
  headerClassName,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
  title: React.ReactNode;
  // Link or small button at the right of the title.
  action?: React.ReactNode;
  // Muted text at the right of the title (a date range, a legend hint).
  aside?: React.ReactNode;
  size?: 'md' | 'sm';
  divider?: boolean;
  headerClassName?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn('flex flex-col gap-3', divider && 'border-t border-border pt-5', className)}
      {...props}
    >
      <div className={cn('flex items-baseline justify-between gap-3', headerClassName)}>
        <h2
          id={id}
          className={cn('font-semibold', size === 'md' ? 'text-heading' : 'text-subtitle')}
        >
          {title}
        </h2>
        {aside && <span className="text-small text-muted-foreground">{aside}</span>}
        {action}
      </div>
      {children}
    </section>
  );
}

// Text link of a section header or a footnote ("Ver todos", "Trocar treino").
// A class, so it fits next/link as well as a plain <a> or <button>.
export const textLinkClass =
  'rounded-xs text-caption font-semibold text-brand-strong underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
