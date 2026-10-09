'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionRunner } from '@/components/session/session-runner';
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
    return (
      <main className="flex flex-1 items-center justify-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>{t('loading')}</span>
      </main>
    );
  }
  return (
    <main className="flex-1 px-4 py-6">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{t(`${state.kind}Title`)}</CardTitle>
          <CardDescription>{t(`${state.kind}Description`)}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Offline, the home screen is the offline page's (precached). */}
          <Button onClick={() => window.location.assign(offlineAwareHref('/'))}>{t('home')}</Button>
        </CardContent>
      </Card>
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
