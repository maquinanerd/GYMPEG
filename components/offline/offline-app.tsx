'use client';

import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { SyncIndicator } from '@/components/offline/sync-indicator';
import { LocalSessionRunner } from '@/components/session/local-session-runner';
import { OfflineHome } from '@/components/offline/offline-home';
import { bindAutoSync } from '@/lib/sync';
import { OFFLINE_PAGE, offlineAwareHref, offlineTarget } from '@/lib/offline-navigation';

// The URL the browser asked for, captured when this module loads, before the
// router hydrates: the page was rendered for /~offline and the router may
// rewrite the history entry to that path during hydration.
const requested =
  typeof window !== 'undefined'
    ? { path: window.location.pathname, search: window.location.search }
    : null;

type Screen = { path: string; search: string };

// The screen to show. Reached two ways:
// - the app sent the lifter here while offline: /~offline?to=<screen>;
// - the service worker answered a navigation it could not deliver with this
//   page: the address bar already holds the screen.
function resolveScreen(current: Screen): Screen {
  if (current.path !== OFFLINE_PAGE) return current;
  const url = new URL(offlineTarget(current.search) ?? '/', window.location.origin);
  return { path: url.pathname, search: url.search };
}

// The offline page (app/~offline). A session URL runs that session from the
// device, anything else shows the offline home (resume or start a workout).
// The outbox keeps flushing from here when the connection comes back.
export function OfflineApp() {
  const [screen, setScreen] = useState<Screen | null>(null);

  useEffect(() => {
    const target = resolveScreen(
      requested ?? { path: window.location.pathname, search: window.location.search },
    );
    // Show the screen's own address: a reload must reopen it (from the
    // server when online, through the service worker fallback when not).
    if (window.location.pathname + window.location.search !== target.path + target.search) {
      window.history.replaceState(window.history.state, '', target.path + target.search);
    }
    setScreen(target);
    return bindAutoSync();
  }, []);

  if (!screen) return null;
  const sessionMatch = /^\/session\/([^/]+)\/?$/.exec(screen.path);
  const sessionId =
    sessionMatch && sessionMatch[1] !== 'new' ? decodeURIComponent(sessionMatch[1]!) : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* The session runner brings its own header (back, coach, sync). */}
      {!sessionId && (
        <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pb-2 pt-4">
          <button
            type="button"
            onClick={() => window.location.assign(offlineAwareHref('/'))}
            className="flex items-center gap-2 rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo size="sm" />
          </button>
          <SyncIndicator />
        </header>
      )}
      {sessionId ? (
        <LocalSessionRunner
          sessionId={sessionId}
          initialProgramExerciseId={
            new URLSearchParams(screen.search).get('programExerciseId') ?? undefined
          }
        />
      ) : (
        <OfflineHome />
      )}
    </div>
  );
}
