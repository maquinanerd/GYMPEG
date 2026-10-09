'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dumbbell } from 'lucide-react';
import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { LocalSessionRunner } from '@/components/session/local-session-runner';
import { OfflineHome } from '@/components/offline/offline-home';
import { bindAutoSync } from '@/lib/sync';

// The URL the browser asked for, captured when this module loads, before the
// router hydrates: the page was rendered for /~offline and the router may
// rewrite the history entry to that path during hydration.
const requested =
  typeof window !== 'undefined'
    ? { path: window.location.pathname, search: window.location.search }
    : null;

// The offline page (app/~offline): the service worker answers every page
// navigation that cannot reach the server with it, whatever the URL. It
// reads the URL itself: a session URL runs that session from the device,
// anything else shows the offline home (resume or start a workout).
// The outbox keeps flushing from here when the connection comes back.
export function OfflineApp() {
  const [location, setLocation] = useState<{ path: string; search: string } | null>(null);

  useEffect(() => {
    const target = requested ?? { path: window.location.pathname, search: window.location.search };
    // Keep the address the lifter is on (a reload must reopen the session).
    if (window.location.pathname !== target.path) {
      window.history.replaceState(window.history.state, '', target.path + target.search);
    }
    setLocation(target);
    return bindAutoSync();
  }, []);

  if (!location) return null;
  const sessionMatch = /^\/session\/([^/]+)\/?$/.exec(location.path);
  const sessionId =
    sessionMatch && sessionMatch[1] !== 'new' ? decodeURIComponent(sessionMatch[1]!) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Dumbbell className="size-5" />
            <span className="text-base font-semibold">GYM Peg</span>
          </Link>
          <OfflineIndicator />
        </div>
      </header>
      {sessionId ? (
        <LocalSessionRunner
          sessionId={sessionId}
          initialProgramExerciseId={
            new URLSearchParams(location.search).get('programExerciseId') ?? undefined
          }
        />
      ) : (
        <OfflineHome />
      )}
    </div>
  );
}
