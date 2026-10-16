import { cn } from '@/lib/utils';

// Loading placeholder in the shape of the real content: a static muted block
// (no pulse, no shimmer). Size it with the classes of what it stands for.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden className={cn('block rounded-xs bg-muted', className)} {...props} />
  );
}

// Screen-level wrapper: announces the load once to assistive tech.
export function SkeletonScreen({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}
