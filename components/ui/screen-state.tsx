'use client';

import { useTranslations } from 'next-intl';
import { CloudSlashIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Error state of a screen or a block whose data did not load: the message and
// "Tentar de novo". `onRetry` defaults to reloading the page.
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations('common.errors');
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-3 py-6', className)}>
      <p className="text-subtitle">{message ?? t('loadFailed')}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry ?? (() => window.location.reload())}
      >
        {t('tryAgain')}
      </Button>
    </div>
  );
}

// Offline note on screens that need the network: training still works, and
// everything stays on the device until the connection comes back.
export function OfflineNotice({ className, children }: { className?: string; children?: React.ReactNode }) {
  const t = useTranslations('common.offline');
  return (
    <p
      role="status"
      className={cn(
        'flex gap-2.5 rounded-sm bg-muted px-3.5 py-3 text-caption leading-[1.4] text-foreground',
        className,
      )}
    >
      <CloudSlashIcon weight="bold" className="mt-px size-[18px] shrink-0 text-muted-foreground" />
      <span>{children ?? t('trainAnyway')}</span>
    </p>
  );
}
