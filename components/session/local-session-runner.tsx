'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SessionRunner } from '@/components/session/session-runner';
import { SessionRunnerSkeleton } from '@/components/session/session-runner-skeleton';
import { getDB } from '@/lib/indexeddb';
import { getOutboxOwner } from '@/lib/outbox-owner';
import { runnerPropsFromPack, type PackRunnerProps } from '@/lib/training-pack';
import { offlineAwareHref } from '@/lib/offline-navigation';

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'finished' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; props: PackRunnerProps };

// Runs a session recorded on this device from the stored training pack: a
// session started offline, or any session reloaded without a network (served
// by the offline page). Loaded once on mount; the runner then reads the sets
// from IndexedDB like the server-rendered page does.
export function LocalSessionRunner({
  sessionId,
  initialProgramExerciseId,
}: {
  sessionId: string;
  initialProgramExerciseId?: string;
}) {
  const t = useTranslations('session.offline');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await loadState(sessionId);
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.kind === 'ready') {
    return <SessionRunner {...state.props} initialProgramExerciseId={initialProgramExerciseId} />;
  }
  if (state.kind === 'loading') {
    return <SessionRunnerSkeleton label={t('loading')} />;
  }
  // Straight on the page, left aligned: what happened, why, and the way home.
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-3 px-5 pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <h1 className="text-heading">{t(`${state.kind}Title`)}</h1>
      <p className="max-w-prose text-caption text-muted-foreground text-pretty">
        {t(`${state.kind}Description`)}
      </p>
      {/* Offline, the home screen is the offline page's (precached). */}
      <Button
        variant="ink"
        size="sm"
        className="mt-1"
        onClick={() => window.location.assign(offlineAwareHref('/'))}
      >
        {t('home')}
      </Button>
    </main>
  );
}

async function loadState(sessionId: string): Promise<State> {
  try {
    const ownerId = getOutboxOwner();
    const db = getDB();
    const session = await db.localSessions.get(sessionId);
    if (!ownerId || !session || session.ownerId !== ownerId) return { kind: 'missing' };
    if (session.finishedAt != null) return { kind: 'finished' };
    const stored = await db.trainingPacks.get(ownerId);
    const props = stored ? runnerPropsFromPack(stored, session, Date.now()) : null;
    return props ? { kind: 'ready', props } : { kind: 'unavailable' };
  } catch {
    // IndexedDB unavailable (private mode, blocked).
    return { kind: 'missing' };
  }
}
