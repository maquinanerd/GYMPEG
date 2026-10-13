import { cn } from '@/lib/utils';

// List row (64px minimum): a leading circle (icon or initials), a title with
// an optional caption, and trailing content. Rows inside one card are split by
// a hairline; the last one has none.
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-h-row items-center gap-3 border-b border-border py-3 last:border-b-0',
        className,
      )}
      {...props}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body">{title}</span>
        {subtitle && <span className="truncate text-small text-muted-foreground">{subtitle}</span>}
      </div>
      {trailing}
    </div>
  );
}

// 40px filled circle for a list row or an insight. The tone is a fill with
// #111 on top, like every accent of the light theme.
export function IconCircle({
  children,
  tone = 'pill',
  className,
}: {
  children: React.ReactNode;
  tone?: 'pill' | 'pr' | 'warning' | 'info' | 'deload' | 'primary';
  className?: string;
}) {
  const fill = {
    pill: 'bg-pill text-foreground',
    pr: 'bg-pr text-pr-foreground',
    warning: 'bg-warning text-warning-foreground',
    info: 'bg-info text-info-foreground',
    deload: 'bg-deload text-deload-foreground',
    primary: 'bg-primary text-primary-foreground',
  }[tone];
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
        fill,
        className,
      )}
    >
      {children}
    </span>
  );
}
