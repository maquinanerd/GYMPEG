'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLiveQuery } from 'dexie-react-hooks';
import { countUnsyncedItems, flushPendingSets } from '@/lib/sync';
import { CloudArrowUpIcon, CloudCheckIcon, CloudSlashIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type SyncState = 'synced' | 'pending' | 'offline';

// Live sync state of the outbox, read from IndexedDB: everything on this
// device that has not reached the server (sets and session starts/finishes).
export function useSyncState() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const pending = useLiveQuery(
    async () => {
      try {
        return await countUnsyncedItems();
      } catch {
        // IndexedDB unavailable (private mode): nothing can be queued either.
        return 0;
      }
    },
    [],
    0,
  );

  const state: SyncState = !online ? 'offline' : pending > 0 ? 'pending' : 'synced';
  return { state, pending, online };
}

// Sync tag (radius 4) in a screen header:
// - synced: grey "Salvo";
// - pending: warning fill "N a enviar" (a tap flushes the outbox now);
// - offline: grey "Sem conexão".
// `compact` drops the text (28px square, the running workout's header); the
// full sentence stays as the accessible name either way.
export function SyncStatus({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations('common.offline');
  const { state, pending } = useSyncState();
  const [flushing, setFlushing] = useState(false);

  const label =
    state === 'offline'
      ? pending > 0
        ? t('pending', { count: pending })
        : t('offline')
      : state === 'pending'
        ? `${t('waiting', { count: pending })}. ${t('syncNow')}`
        : t('synced');
  const short =
    state === 'offline'
      ? t('offlineShort')
      : state === 'pending'
        ? t('toSendShort', { count: pending })
        : t('savedShort');

  async function syncNow() {
    if (state !== 'pending' || flushing) return;
    setFlushing(true);
    try {
      await flushPendingSets();
    } finally {
      setFlushing(false);
    }
  }

  const Glyph =
    state === 'offline' ? CloudSlashIcon : state === 'pending' ? CloudArrowUpIcon : CloudCheckIcon;

  return (
    <button
      type="button"
      onClick={syncNow}
      aria-label={label}
      title={label}
      aria-busy={flushing || undefined}
      data-sync-state={state}
      className={cn(
        'flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-xs text-small font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        compact ? 'w-7' : 'px-2.5',
        state === 'pending'
          ? 'cursor-pointer bg-warning text-warning-foreground'
          : 'cursor-default bg-muted text-muted-foreground',
        flushing && 'opacity-60',
        className,
      )}
    >
      <Glyph weight="bold" className={compact ? 'size-[15px]' : 'size-3.5'} />
      {!compact && <span className="whitespace-nowrap">{short}</span>}
    </button>
  );
}
