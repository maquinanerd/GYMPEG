import Link from 'next/link';
import type { AppIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** @deprecated v2 empty states are text only; the icon is ignored. */
  icon?: AppIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

// Empty state: specific text and one action, straight on the page (no card,
// no icon in a circle). Left aligned like the rest of the screen.
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-3 py-6', className)}>
      <div className="flex flex-col gap-1">
        <p className="text-subtitle">{title}</p>
        {description && (
          <p className="max-w-prose text-caption text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Button asChild variant="ink" size="sm" className="mt-1">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
