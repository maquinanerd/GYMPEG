import { flushPendingSets } from '@/lib/sync';
import { deleteLocalDB, getDB } from '@/lib/indexeddb';

// Client-side cleanup on logout. The service worker caches pages and API
// responses that contain the user's training and health data; on a shared
// device the next person could read them offline. Cache Storage is always
// cleared. The IndexedDB outbox is dropped only once nothing is left to
// sync: unsynced sets are the user's own training and must never be lost by
// signing out.
export async function clearLocalUserData(): Promise<{ keptPendingSets: number }> {
  if (typeof window === 'undefined') return { keptPendingSets: 0 };

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  let keptPendingSets = 0;
  try {
    await flushPendingSets();
    keptPendingSets = await getDB()
      .pendingSets.where('status')
      .anyOf('pending', 'failed', 'syncing')
      .count();
    if (keptPendingSets === 0) await deleteLocalDB();
  } catch {
    // IndexedDB unavailable (private mode, blocked): nothing stored to clear.
  }
  return { keptPendingSets };
}
