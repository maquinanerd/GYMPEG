'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/ui/screen-state';

// The workout did not load (server or network failure). "Try again" re-runs
// the page; sets already logged stay on the device in the meantime.
export default function SessionRunError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('session');
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-[calc(1rem+env(safe-area-inset-top))]">
      <ErrorState message={t('loadError')} onRetry={reset} />
    </main>
  );
}
