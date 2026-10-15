'use client';

import { useTranslations } from 'next-intl';
import { ScreenHeader } from '@/components/nav/screen-header';
import { ErrorState } from '@/components/ui/screen-state';

// The coach did not load (database or provider down): say so and retry. The
// rest of the app, training included, keeps working.
export default function CoachError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('coach');
  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <ScreenHeader title={t('title')} subtitle={t('subtitle')} />
      <ErrorState className="px-5" onRetry={reset} />
    </main>
  );
}
