// Hydrates IndexedDB with the sets fetched from the server.
//
// IndexedDB is the single source of truth for display (the components use
// useLiveQuery on Dexie), so each server set must map to exactly ONE local
// row. A set logged on this device already has one (localId "loc_*", and the
// server stored that id as clientMutationId); only sets the device has never
// seen get a new "srv_<id>" row. Re-running is idempotent.
//
// Before this matching, a reload in the middle of a session showed every
// synced set twice (its loc_* row plus a fresh srv_* row).

import type { Set as PrismaSet } from '@/lib/prisma-client';
import { getDB, type PendingSet } from '@/lib/indexeddb';

function fromServer(sessionId: string, s: PrismaSet): Omit<PendingSet, 'localId'> {
  return {
    sessionId,
    exerciseId: s.exerciseId,
    gymEquipmentId: s.gymEquipmentId,
    setNumber: s.setNumber,
    weight: s.weight,
    reps: s.reps,
    rir: s.rir,
    durationSec: s.durationSec,
    distanceM: s.distanceM,
    notes: s.notes,
    isWarmup: s.isWarmup,
    isDropSet: s.isDropSet,
    createdAt: new Date(s.completedAt).getTime(),
    status: 'synced',
    serverId: s.id,
    syncedAt: new Date(s.completedAt).getTime(),
    attempts: 0,
    lastError: null,
  };
}

export async function hydrateFromServerSets(
  sessionId: string,
  serverSets: PrismaSet[],
): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.pendingSets, async () => {
    const local = await db.pendingSets.where('sessionId').equals(sessionId).toArray();
    const byLocalId = new Map(local.map((row) => [row.localId, row]));

    // Rows already bound to a server set. When several are (duplicates left by
    // the old hydration), keep the device's own loc_* row.
    const byServerId = new Map<string, PendingSet>();
    const duplicateIds: string[] = [];
    for (const row of local) {
      if (!row.serverId) continue;
      const kept = byServerId.get(row.serverId);
      if (!kept) {
        byServerId.set(row.serverId, row);
      } else if (kept.localId.startsWith('srv_') && !row.localId.startsWith('srv_')) {
        duplicateIds.push(kept.localId);
        byServerId.set(row.serverId, row);
      } else {
        duplicateIds.push(row.localId);
      }
    }
    if (duplicateIds.length > 0) await db.pendingSets.bulkDelete(duplicateIds);

    const additions: PendingSet[] = [];
    for (const s of serverSets) {
      const own =
        byServerId.get(s.id) ??
        (s.clientMutationId ? byLocalId.get(s.clientMutationId) : undefined);
      if (!own) {
        additions.push({ localId: `srv_${s.id}`, ...fromServer(sessionId, s) });
        continue;
      }
      if (own.status === 'synced') {
        // Server is the truth for settled rows (an edit from another device).
        await db.pendingSets.put({ ...fromServer(sessionId, s), localId: own.localId });
      } else if (!own.serverId) {
        // A pending local edit wins over the server copy; only bind the id.
        await db.pendingSets.update(own.localId, { serverId: s.id });
      }
    }
    if (additions.length > 0) await db.pendingSets.bulkPut(additions);
  });
}
