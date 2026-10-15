'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowClockwiseIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LimeBlock } from '@/components/ui/lime-block';
import { OfflineNotice } from '@/components/ui/screen-state';
import { Section } from '@/components/ui/section';
import { useTrainingName } from '@/components/shared/use-training-name';
import { getDB } from '@/lib/indexeddb';
import { getOutboxOwner } from '@/lib/outbox-owner';
import { startSession } from '@/lib/session-lifecycle';
import { countUnsyncedItems } from '@/lib/sync';
import { offlineAwareHref } from '@/lib/offline-navigation';

// Home of the offline page: resume the workout in progress on this device or
// start one of the stored program's workouts, all without a network. Same
// language as the online home: the workout in progress is the lime block,
// the program's workouts are rows on the page.
export function OfflineHome() {
  const t = useTranslations('session.offline');
  const session = useTranslations('session');
  const trainingName = useTrainingName();
  const [online, setOnline] = useState(false);
  const [starting, startTransition] = useTransition();
  const [startingId, setStartingId] = useState<string | null>(null);

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
    setStartingId(workoutId);
    startTransition(async () => {
      try {
        const started = await startSession({ workoutId, gymId: null });
        open(started.id);
      } catch {
        toast.error(session('startError'));
      }
    });
  }

  const [current, ...otherOpen] = data.open;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-7">
      <div className="flex flex-col items-start gap-3 px-5 pb-5 pt-2">
        <h1 className="text-title">{t('title')}</h1>
        <OfflineNotice className="self-stretch" />
        {data.pending > 0 && (
          <p className="text-caption text-muted-foreground">
            {t('pending', { count: data.pending })}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11"
          onClick={() => window.location.assign('/')}
        >
          <ArrowClockwiseIcon weight="bold" />
          {online ? t('reconnect') : t('retry')}
        </Button>
      </div>

      {!data.ownerId ? (
        <p className="px-5 text-body text-muted-foreground">{t('signedOut')}</p>
      ) : (
        <>
          {current && (
            <LimeBlock aria-labelledby="offline-resume-title" data-testid="offline-resume">
              <p className="text-caption font-semibold text-brand-strong">{t('resumeTitle')}</p>
              <h2 id="offline-resume-title" className="text-display [overflow-wrap:anywhere]">
                {workoutName(current.workoutId) ?? t('resumeTitle')}
              </h2>
              <Button type="button" variant="ink" className="w-full" onClick={() => open(current.id)}>
                {t('resume')}
              </Button>
              {/* Rare: more than one unfinished workout on this device. */}
              {otherOpen.length > 0 && (
                <ul className="flex flex-col">
                  {otherOpen.map((item) => {
                    const nameId = `offline-open-${item.id}`;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 border-t border-ink/[0.14] py-1"
                      >
                        <span id={nameId} className="min-w-0 text-body">
                          {workoutName(item.workoutId) ?? t('resumeTitle')}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-11 hover:bg-ink/[0.08]"
                          aria-describedby={nameId}
                          onClick={() => open(item.id)}
                        >
                          {t('resume')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </LimeBlock>
          )}

          <div className={current ? 'px-5 pt-7' : 'px-5'}>
            {data.pack && data.pack.workouts.length > 0 ? (
              <Section title={t('startTitle')} className="gap-1.5">
                {data.pack.program && (
                  <p className="text-[0.8125rem] font-medium text-muted-foreground">
                    {trainingName(data.pack.program.name)}
                  </p>
                )}
                <ul className="mt-1.5 flex flex-col">
                  {data.pack.workouts.map(({ workout }) => {
                    const nameId = `offline-workout-${workout.id}`;
                    return (
                      <li
                        key={workout.id}
                        className="flex min-h-[3.25rem] items-center justify-between gap-3 border-t border-border py-2"
                      >
                        <span id={nameId} className="min-w-0 text-body font-semibold">
                          {trainingName(workout.name)}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 shrink-0 px-4 text-body"
                          disabled={starting}
                          loading={starting && startingId === workout.id}
                          aria-describedby={nameId}
                          onClick={() => start(workout.id)}
                        >
                          {t('start')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            ) : (
              <p className="text-body text-muted-foreground [text-wrap:pretty]">{t('noPack')}</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
