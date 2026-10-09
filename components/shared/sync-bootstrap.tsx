'use client';

import { useEffect, useLayoutEffect } from 'react';
import { bindAutoSync, pruneSyncedSessions, pruneSyncedSets } from '@/lib/sync';
import { setOutboxOwner } from '@/lib/outbox-owner';

// Invisible component that starts automatic sync on mount.
// Lives in the (app)/ and (print)/ layouts, so it is active on all protected routes.
// - Before any effect of the page: records which account the outbox belongs
//   to, so a flush (here or from the session runner) sends only its items.
// - On mount: flush if online + listener for the 'online' event.
// - On mount: prune synced sets and sessions older than 7 days to keep Dexie lean.
export function SyncBootstrap({ ownerId }: { ownerId: string | null }) {
  // A layout effect runs before every passive effect in the tree, including
  // the session runner's own bindAutoSync().
  useLayoutEffect(() => {
    if (ownerId) setOutboxOwner(ownerId);
  }, [ownerId]);

  useEffect(() => {
    const cleanup = bindAutoSync();
    void pruneSyncedSets();
    void pruneSyncedSessions();
    return cleanup;
  }, []);
  return null;
}
