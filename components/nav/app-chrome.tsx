'use client';

import { usePathname } from 'next/navigation';
import { TabBar } from '@/components/nav/tab-bar';
import { cn } from '@/lib/utils';

// The running workout (/session/<id>) owns the whole screen: no tab bar (its
// header carries the coach button and the sync tag instead).
export function isSessionRunnerPath(pathname: string): boolean {
  return /^\/session\/(?!new(?:\/|$))[^/]+\/?$/.test(pathname);
}

// Chrome of the signed-in app: just the docked tab bar. Every screen keeps
// room at the bottom for it so nothing sits under the bar.
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullscreen = isSessionRunnerPath(pathname);

  return (
    <>
      <div
        className={cn(
          'flex flex-1 flex-col',
          !fullscreen && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]',
        )}
      >
        {children}
      </div>
      {!fullscreen && <TabBar />}
    </>
  );
}
