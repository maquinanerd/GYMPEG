'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLiveQuery } from 'dexie-react-hooks';
import { countUnsyncedItems, flushPendingSets } from '@/lib/sync';
import { CloudArrowUpIcon, CloudCheckIcon, CloudSlashIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

type SyncState = 'synced' | 'pending' | 'offline';

// Sync state of the outbox, where a notification bell would usually sit:
// - synced: CloudCheck with a brand dot;
// - pending: CloudArrowUp with a warning badge counting the queued items (a tap
//   flushes the outbox now);
// - offline: CloudSlash, grey.
// The count is everything on this device that has not reached the server
// (sets and session starts/finishes), read live from IndexedDB.
export function SyncIndicator({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  const t = useTranslations('common.offline');
  const [online, setOnline] = useState(true);
  const [flushing, setFlushing] = useState(false);

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
  const label =
    state === 'offline'
      ? pending > 0
        ? t('pending', { count: pending })
        : t('offline')
      : state === 'pending'
        ? `${t('waiting', { count: pending })}. ${t('syncNow')}`
        : t('synced');

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
        'relative flex shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        size === 'lg' ? 'size-12' : 'size-11',
        state === 'pending' ? 'cursor-pointer hover:text-foreground' : 'cursor-default',
        className,
      )}
    >
      <Glyph className={cn('size-5', flushing && 'motion-safe:animate-pulse')} />
      {state === 'synced' && (
        <span
          aria-hidden
          className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand ring-2 ring-card"
        />
      )}
      {state !== 'synced' && pending > 0 && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warning px-1 text-[11px] font-bold tabular-nums text-warning-foreground"
        >
          {pending > 99 ? '99+' : pending}
        </span>
      )}
    </button>
  );
}
