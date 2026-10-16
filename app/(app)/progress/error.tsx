'use client';

import { useTranslations } from 'next-intl';
import { ScreenHeader } from '@/components/nav/screen-header';
import { ErrorState } from '@/components/ui/screen-state';

// Evolução (and its weekly report) failed to load: the header stays, then the
// message and "Tentar de novo", which re-renders the route segment.
export default function ProgressError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('progress');
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl">
        <ScreenHeader title={t('title')} />
        <ErrorState className="px-5" onRetry={reset} />
      </div>
    </main>
  );
}
