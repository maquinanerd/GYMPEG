import { countUnsyncedItems, flushPendingSets } from '@/lib/sync';
import { deleteLocalDB } from '@/lib/indexeddb';
import { setOutboxOwner } from '@/lib/outbox-owner';
import { deleteTrainingPacks } from '@/lib/training-pack';

// Workbox names its precache "workbox-precache-v2-<scope>".
const PRECACHE_PREFIX = 'workbox-precache';

// Client-side cleanup on logout. The service worker no longer caches pages
// or API responses, but a device updated from an older version may still
// hold some with the user's training and health data; on a shared device the
// next person could read them offline. Cache Storage is always cleared,
// except the Workbox precache: it holds only the public build (scripts,
// styles, the offline page) and is not refilled until the next deploy, so
// dropping it would break offline mode for the next sign-in. The training
// pack is always dropped too. The IndexedDB outbox is dropped only once
// nothing is left to sync: unsynced sessions and sets are the user's own
// training and must never be lost by signing out. They stay scoped to their
// account and are sent the next time that account signs in on this device.
export async function clearLocalUserData(): Promise<{ keptPendingSets: number }> {
  if (typeof window === 'undefined') return { keptPendingSets: 0 };

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => !key.startsWith(PRECACHE_PREFIX)).map((key) => caches.delete(key)),
    );
  }

  let keptPendingSets = 0;
  try {
    await flushPendingSets();
    // The training pack can be downloaded again; the outbox cannot.
    await deleteTrainingPacks();
    keptPendingSets = await countUnsyncedItems();
    if (keptPendingSets === 0) await deleteLocalDB();
  } catch {
    // IndexedDB unavailable (private mode, blocked): nothing stored to clear.
  }
  setOutboxOwner(null);
  return { keptPendingSets };
}
