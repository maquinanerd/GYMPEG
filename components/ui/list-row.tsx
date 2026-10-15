import Link from 'next/link';
import { CaretRightIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// List row: content straight on the page, a hairline on top, no box. A grid
// of an optional leading slot (thumbnail, day), the title with its meta line,
// the value on the right and an optional chevron. 52px minimum (68px with a
// thumbnail). Rendered as an <li> so a list is a real <ul>/<ol>; with `href`
// the whole row is the link.
export function ListRow({
  leading,
  title,
  meta,
  subtitle,
  value,
  trailing,
  chevron = false,
  href,
  className,
  contentClassName,
  ...props
}: Omit<React.LiHTMLAttributes<HTMLLIElement>, 'title'> & {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** @deprecated v1 name; use `meta`. */
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  href?: string;
  contentClassName?: string;
}) {
  const metaLine = meta ?? subtitle;
  const content = (
    <>
      {leading}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-semibold">{title}</span>
        {metaLine && (
          <span className="text-[0.8125rem] font-medium text-muted-foreground">{metaLine}</span>
        )}
      </span>
      {value != null && <span className="text-right">{value}</span>}
      {trailing}
      {chevron && <CaretRightIcon aria-hidden className="size-4 text-subtle" />}
    </>
  );
  const inner = cn(
    'grid min-h-[3.25rem] items-center gap-3 py-3',
    leading ? 'grid-cols-[auto_minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto_auto]',
    contentClassName,
  );
  return (
    <li className={cn('border-t border-border', className)} {...props}>
      {href ? (
        <Link
          href={href}
          className={cn(
            inner,
            'text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          )}
        >
          {content}
        </Link>
      ) : (
        <div className={inner}>{content}</div>
      )}
    </li>
  );
}

/** @deprecated v1: icons in colored circles are gone. Renders the bare icon. */
export function IconCircle({
  children,
  className,
}: {
  children: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center [&_svg]:size-5', className)}>
      {children}
    </span>
  );
}
