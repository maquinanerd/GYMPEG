'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudOff, Play, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrainingName } from '@/components/shared/use-training-name';
import { getDB } from '@/lib/indexeddb';
import { getOutboxOwner } from '@/lib/outbox-owner';
import { startSession } from '@/lib/session-lifecycle';
import { countUnsyncedItems } from '@/lib/sync';
import { offlineAwareHref } from '@/lib/offline-navigation';

// Home of the offline page: resume the workout in progress on this device or
// start one of the stored program's workouts, all without a network.
export function OfflineHome() {
  const t = useTranslations('session.offline');
  const session = useTranslations('session');
  const trainingName = useTrainingName();
  const [online, setOnline] = useState(false);
  const [starting, startTransition] = useTransition();

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const data = useLiveQuery(async () => {
    const ownerId = getOutboxOwner();
    if (!ownerId) return { ownerId: null, open: [], pack: undefined, pending: 0 };
    const db = getDB();
    const [sessions, stored, pending] = await Promise.all([
      db.localSessions.where('ownerId').equals(ownerId).toArray(),
      db.trainingPacks.get(ownerId),
      countUnsyncedItems(),
    ]);
    const open = sessions
      .filter((item) => item.finishedAt == null && item.createStatus !== 'failed')
      .sort((a, b) => b.startedAt - a.startedAt);
    return { ownerId, open, pack: stored?.pack, pending };
  }, []);

  if (!data) return null;

  const workoutName = (workoutId: string) => {
    const entry = data.pack?.workouts.find((item) => item.workout.id === workoutId);
    return entry ? trainingName(entry.workout.name) : null;
  };

  function open(sessionId: string) {
    window.location.assign(offlineAwareHref(`/session/${encodeURIComponent(sessionId)}`));
  }

  function start(workoutId: string) {
    startTransition(async () => {
      try {
        const started = await startSession({ workoutId, gymId: null });
        open(started.id);
      } catch {
        toast.error(session('startError'));
      }
    });
  }

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex items-start gap-3">
          <CloudOff className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
            {data.pending > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('pending', { count: data.pending })}
              </p>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          className="self-start"
          onClick={() => window.location.assign('/')}
        >
          <RotateCw className="size-4" />
          <span className="ml-2">{online ? t('reconnect') : t('retry')}</span>
        </Button>

        {!data.ownerId ? (
          <p className="text-sm text-muted-foreground">{t('signedOut')}</p>
        ) : (
          <>
            {data.open.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('resumeTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {data.open.map((item) => (
                    <Button
                      key={item.id}
                      onClick={() => open(item.id)}
                      className="min-h-tap justify-between"
                    >
                      <span>{workoutName(item.workoutId) ?? t('resumeTitle')}</span>
                      <span>{t('resume')}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.pack && data.pack.workouts.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('startTitle')}</CardTitle>
                  {data.pack.program && (
                    <CardDescription>{trainingName(data.pack.program.name)}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {data.pack.workouts.map(({ workout }) => (
                    <Button
                      key={workout.id}
                      variant="secondary"
                      disabled={starting}
                      onClick={() => start(workout.id)}
                      className="min-h-tap justify-between"
                    >
                      <span>{trainingName(workout.name)}</span>
                      <span className="flex items-center gap-1">
                        <Play className="size-4" />
                        {t('start')}
                      </span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noPack')}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
