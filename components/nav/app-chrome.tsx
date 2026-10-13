'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BottomNav } from '@/components/nav/bottom-nav';
import { CoachFab } from '@/components/coach/coach-fab';
import { SegmentedLinks } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

// The running workout (/session/<id>) owns the whole screen: no bottom bar and
// no floating coach (its header carries the coach button instead).
export function isSessionRunnerPath(pathname: string): boolean {
  return /^\/session\/(?!new(?:\/|$))[^/]+\/?$/.test(pathname);
}

// The three lists grouped under the "Treinos" tab.
const TRAINING_TABS = [
  { href: '/programs', key: 'programs' },
  { href: '/history', key: 'history' },
  { href: '/exercises', key: 'exercises' },
] as const;

// Chrome of the signed-in app: the floating bottom bar, the coach button and,
// on the Treinos lists, the Programas · Histórico · Exercícios switch. Every
// main screen ends with room for the bar (>= 140px) so nothing sits under it.
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const fullscreen = isSessionRunnerPath(pathname);
  // The coach screen is where the button leads: no point floating it there.
  const onCoach = pathname === '/coach' || pathname.startsWith('/coach/');
  const trainingTab = TRAINING_TABS.find((tab) => tab.href === pathname);

  return (
    <>
      <div
        className={cn(
          'flex flex-1 flex-col',
          !fullscreen && 'pb-[calc(8.75rem+env(safe-area-inset-bottom))]',
        )}
      >
        {trainingTab && (
          <div className="mx-auto w-full max-w-2xl px-4 pt-4">
            <SegmentedLinks
              label={t('trainingLabel')}
              items={TRAINING_TABS.map((tab) => ({
                href: tab.href,
                label: t(tab.key),
                active: tab.href === pathname,
              }))}
            />
          </div>
        )}
        {children}
      </div>
      {!fullscreen && (
        <>
          {!onCoach && <CoachFab label={t('openCoach')} />}
          <BottomNav />
        </>
      )}
    </>
  );
}
