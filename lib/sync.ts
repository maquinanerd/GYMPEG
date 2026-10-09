// ============================================================
// Sync outbox: flush what this device recorded to the API (ADR-004)
// ============================================================
// Strategy:
// 1. Starting a session, validating a set and finishing a session write to
//    IndexedDB first (status 'pending') and trigger a flush.
// 2. flushPendingSets() sends, in this order: the session starts, the sets,
//    then the finishes. A set waits for its session to exist on the server;
//    a finish waits until every set of its session is sent.
// 3. The set changes of a session (creates, corrections, deletions) go in one
//    batched request with a result per item, so one refused set never holds
//    back the others (POST /api/sessions/[id]/sets/batch).
// 4. A deletion is a tombstone: the row is hidden at once and removed from
//    the device only after the server confirms, so deleting works offline.
// 5. Only the items of the signed-in account are sent (lib/outbox-owner).
// 6. On app startup + on the 'online' event, we call flushPendingSets().
// 7. No aggressive retry: we wait for the next trigger (online, validation,
//    startup). If you cut the wifi in the middle, the app will retry when
//    the network comes back. No background timer, to save battery.

import { getDB, type LocalSession, type PendingSet } from '@/lib/indexeddb';
import { getOutboxOwner, ownedBy } from '@/lib/outbox-owner';
import {
  isFatalItemStatus,
  MAX_BATCH_ITEMS,
  type BatchItem,
  type BatchItemResult,
} from '@/lib/set-batch';
import { refreshTrainingPack } from '@/lib/training-pack';

export type PendingSetUpdateState = 'missing' | 'failed' | 'synced' | 'queued';

export function pendingSetUpdateState(set: PendingSet | undefined): PendingSetUpdateState {
  if (!set) return 'missing';
  if (set.status === 'failed') return 'failed';
  if (set.status === 'synced') return 'synced';
  return 'queued';
}

export interface FlushResult {
  flushed: number;
  failed: number;
  pending: number;
  // Sets the server recorded WITHOUT the equipment reference that was sent
  // (issue #326): the item was deleted, unlinked, belongs to another gym or
  // another user. The set itself is saved; only the decoration was dropped.
  droppedEquipment: DroppedEquipment[];
}

export interface DroppedEquipment {
  localId: string;
  sessionId: string;
  gymEquipmentId: string;
}

type DroppedEquipmentListener = (dropped: DroppedEquipment[]) => void;

const droppedEquipmentListeners = new Set<DroppedEquipmentListener>();

// Subscribe to equipment references the server dropped while flushing. The
// flush runs in the background (queueSet does not await it), so the session
// UI cannot read the result directly; it listens here instead. Returns the
// unsubscribe function.
export function onEquipmentDropped(listener: DroppedEquipmentListener): () => void {
  droppedEquipmentListeners.add(listener);
  return () => {
    droppedEquipmentListeners.delete(listener);
  };
}

let inFlight: Promise<FlushResult> | null = null;
let rerunRequested = false;

export async function flushPendingSets(): Promise<FlushResult> {
  // Re-entrancy: a flush asked for while one runs (a set logged, corrected or
  // deleted meanwhile) shares its promise and makes it run once more at the
  // end, so that change does not wait for the next trigger.
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }
  inFlight = (async () => {
    let result: FlushResult;
    do {
      rerunRequested = false;
      result = await doFlush();
    } while (rerunRequested && navigator.onLine);
    return result;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

// A request that never answers must not hold the queue forever.
const REQUEST_TIMEOUT_MS = 15_000;

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;
}

// 400/404/409 will not change on a retry (workout or session gone, id taken):
// the item is marked failed instead of being resent forever.
function isFatalStatus(status: number): boolean {
  return status === 400 || status === 404 || status === 409;
}

async function errorMessage(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `HTTP ${res.status}`;
}

async function doFlush(): Promise<FlushResult> {
  const owner = getOutboxOwner();
  await flushSessionStarts(owner);
  // Before the sets: a set of a replaced exercise takes its row's targets.
  await flushSessionSwaps(owner);
  const result = await flushSets(owner);
  await flushSessionFinishes(owner);
  return result;
}

// Exercises replaced only for a session, sent as the session's whole map.
async function flushSessionSwaps(owner: string | null): Promise<void> {
  const db = getDB();
  const pending = (await ownedSessions(owner)).filter(
    (session) => session.swapsStatus === 'pending' && session.createStatus === 'synced',
  );
  for (const session of pending) {
    if (!navigator.onLine) break;
    const sent = session.exerciseSwaps ?? {};
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(session.id)}`, {
        method: 'PUT',
        signal: timeoutSignal(),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseSwaps: sent }),
      });
      if (res.ok) {
        // A newer swap made while this request was in flight stays pending.
        await db.transaction('rw', db.localSessions, async () => {
          const latest = await db.localSessions.get(session.id);
          const unchanged = JSON.stringify(latest?.exerciseSwaps ?? {}) === JSON.stringify(sent);
          if (unchanged) {
            await db.localSessions.update(session.id, { swapsStatus: 'synced', lastError: null });
          }
        });
      } else {
        await db.localSessions.update(session.id, {
          swapsStatus: isFatalStatus(res.status) ? 'failed' : 'pending',
          attempts: session.attempts + 1,
          lastError: await errorMessage(res),
        });
      }
    } catch (err) {
      await db.localSessions.update(session.id, {
        attempts: session.attempts + 1,
        lastError: err instanceof Error ? err.message : 'network',
      });
    }
  }
}

async function ownedSessions(owner: string | null): Promise<LocalSession[]> {
  if (!owner) return [];
  return getDB().localSessions.where('ownerId').equals(owner).toArray();
}

// Sessions started on this device while offline: created on the server with
// the device id, so the sets queued against that id land in it.
async function flushSessionStarts(owner: string | null): Promise<void> {
  const db = getDB();
  const starts = (await ownedSessions(owner))
    .filter((session) => session.createStatus === 'pending')
    .sort((a, b) => a.startedAt - b.startedAt);

  for (const session of starts) {
    if (!navigator.onLine) break;
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        signal: timeoutSignal(),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: session.id,
          workoutId: session.workoutId,
          gymId: session.gymId,
          startedAt: session.startedAt,
        }),
      });
      if (res.ok) {
        await db.localSessions.update(session.id, { createStatus: 'synced', lastError: null });
      } else {
        await db.localSessions.update(session.id, {
          createStatus: isFatalStatus(res.status) ? 'failed' : 'pending',
          attempts: session.attempts + 1,
          lastError: await errorMessage(res),
        });
      }
    } catch (err) {
      await db.localSessions.update(session.id, {
        attempts: session.attempts + 1,
        lastError: err instanceof Error ? err.message : 'network',
      });
    }
  }
}

// Finishes recorded on this device, sent once every set of the session has
// reached the server (a finish first would make the server refuse sets
// performed after the server-side finish time).
async function flushSessionFinishes(owner: string | null): Promise<void> {
  const db = getDB();
  const finishes = (await ownedSessions(owner)).filter(
    (session) => session.finishStatus === 'pending' && session.createStatus === 'synced',
  );

  for (const session of finishes) {
    if (!navigator.onLine) break;
    const unsentSets = await db.pendingSets
      .where('sessionId')
      .equals(session.id)
      .filter((row) => row.status === 'pending' || row.status === 'syncing')
      .count();
    if (unsentSets > 0) continue;
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(session.id)}`, {
        method: 'PUT',
        signal: timeoutSignal(),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finish: true,
          ...(session.finishedAt != null ? { finishedAt: session.finishedAt } : {}),
          ...(session.notes != null ? { notes: session.notes } : {}),
        }),
      });
      if (res.ok) {
        await db.localSessions.update(session.id, { finishStatus: 'synced', lastError: null });
      } else {
        await db.localSessions.update(session.id, {
          finishStatus: isFatalStatus(res.status) ? 'failed' : 'pending',
          attempts: session.attempts + 1,
          lastError: await errorMessage(res),
        });
      }
    } catch (err) {
      await db.localSessions.update(session.id, {
        attempts: session.attempts + 1,
        lastError: err instanceof Error ? err.message : 'network',
      });
    }
  }
}

async function flushSets(owner: string | null): Promise<FlushResult> {
  const db = getDB();
  // 'syncing' rows are included: a tab closed mid-request leaves them stuck in
  // that state forever otherwise. Re-sending is safe: the server deduplicates
  // creates on clientMutationId, corrections are idempotent and deleting
  // something already gone succeeds.
  const queued = await db.pendingSets
    .where('status')
    .anyOf(['pending', 'failed', 'syncing'])
    .sortBy('createdAt');
  // A set of a session whose start has not reached the server yet waits for
  // it (the start is retried first on every flush).
  const sessionsNotOnServer = new Set(
    (await ownedSessions(owner))
      .filter((session) => session.createStatus === 'pending')
      .map((session) => session.id),
  );
  // One batch per session, in the order the changes were made.
  const bySession = new Map<string, PendingSet[]>();
  for (const item of queued) {
    if (!ownedBy(owner, item) || sessionsNotOnServer.has(item.sessionId)) continue;
    const group = bySession.get(item.sessionId);
    if (group) group.push(item);
    else bySession.set(item.sessionId, [item]);
  }

  const totals: FlushResult = { flushed: 0, failed: 0, pending: 0, droppedEquipment: [] };
  sessions: for (const [sessionId, items] of bySession) {
    for (let start = 0; start < items.length; start += MAX_BATCH_ITEMS) {
      // No point trying if we know we are offline.
      if (!navigator.onLine) break sessions;
      await pushBatch(sessionId, items.slice(start, start + MAX_BATCH_ITEMS), totals);
    }
  }

  totals.pending = await db.pendingSets.where('status').anyOf(['pending', 'failed']).count();
  if (totals.droppedEquipment.length > 0) {
    for (const listener of droppedEquipmentListeners) {
      listener(totals.droppedEquipment);
    }
  }
  return totals;
}

// Rows hydrated from the server (srv_*) were not logged under their local id.
function isDeviceKey(localId: string): boolean {
  return !localId.startsWith('srv_');
}

function correctionOf(item: PendingSet) {
  return {
    weight: item.weight,
    reps: item.reps,
    rir: item.rir,
    // Absent on rows queued before RPE existed: the server keeps its value.
    ...(item.rpe !== undefined ? { rpe: item.rpe } : {}),
  };
}

function batchItemFor(item: PendingSet, withoutEquipment: boolean): BatchItem {
  if (item.deletedAt != null) {
    return {
      op: 'delete',
      key: item.localId,
      ...(item.serverId ? { setId: item.serverId } : {}),
      ...(isDeviceKey(item.localId) ? { clientMutationId: item.localId } : {}),
    };
  }
  if (item.serverId != null) {
    return { op: 'update', key: item.localId, setId: item.serverId, patch: correctionOf(item) };
  }
  return {
    op: 'create',
    key: item.localId,
    set: {
      exerciseId: item.exerciseId,
      gymEquipmentId: withoutEquipment ? null : (item.gymEquipmentId ?? null),
      setNumber: item.setNumber,
      weight: item.weight,
      reps: item.reps,
      rir: item.rir,
      durationSec: item.durationSec ?? null,
      distanceM: item.distanceM ?? null,
      notes: item.notes,
      isWarmup: item.isWarmup,
      isDropSet: item.isDropSet,
      ...(item.type ? { type: item.type } : {}),
      ...(item.rpe != null ? { rpe: item.rpe } : {}),
      // Idempotency key: a retry of this very set returns the stored row.
      clientMutationId: item.localId,
      // When it was performed on the device, not when it reached the server.
      performedAt: item.createdAt,
    },
  };
}

async function pushBatch(
  sessionId: string,
  items: PendingSet[],
  totals: FlushResult,
  withoutEquipment = false,
): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.pendingSets, async () => {
    for (const item of items) await db.pendingSets.update(item.localId, { status: 'syncing' });
  });
  const sent = items.map((item) => batchItemFor(item, withoutEquipment));

  let res: Response;
  try {
    res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/sets/batch`, {
      method: 'POST',
      signal: timeoutSignal(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: sent }),
    });
  } catch (err) {
    // Network error (offline, timeout): everything stays pending.
    const lastError = err instanceof Error ? err.message : 'network';
    for (const item of items) {
      await db.pendingSets.update(item.localId, {
        status: 'pending',
        attempts: (item.attempts ?? 0) + 1,
        lastError,
      });
    }
    totals.failed += items.length;
    return;
  }

  if (!res.ok) {
    // The whole batch was refused (session gone, signed out, server down).
    const lastError = await errorMessage(res);
    const fatal = isFatalStatus(res.status);
    for (const item of items) {
      // Nothing of this session is left to delete for this account.
      if (fatal && item.deletedAt != null) {
        await db.pendingSets.delete(item.localId);
        continue;
      }
      await db.pendingSets.update(item.localId, {
        status: fatal ? 'failed' : 'pending',
        attempts: (item.attempts ?? 0) + 1,
        lastError,
      });
    }
    totals.failed += items.length;
    return;
  }

  const body = (await res.json().catch(() => null)) as { results?: BatchItemResult[] } | null;
  const byKey = new Map((body?.results ?? []).map((result) => [result.key, result]));
  const retryWithoutEquipment: PendingSet[] = [];
  for (const [index, item] of items.entries()) {
    const op = sent[index]!;
    const result = byKey.get(item.localId);
    // Equipment is optional metadata. If a server version rejects a stale
    // reference with 400, the set is resent once without it so the training
    // itself is never stranded by an inventory decoration.
    if (
      op.op === 'create' &&
      result?.status === 400 &&
      !withoutEquipment &&
      item.gymEquipmentId != null
    ) {
      retryWithoutEquipment.push(item);
      continue;
    }
    await applyItemResult(item, op, result, totals);
  }
  if (retryWithoutEquipment.length > 0) {
    await pushBatch(sessionId, retryWithoutEquipment, totals, true);
  }
}

async function applyItemResult(
  item: PendingSet,
  op: BatchItem,
  result: BatchItemResult | undefined,
  totals: FlushResult,
): Promise<void> {
  const db = getDB();
  const status = result?.status ?? 0;
  const done = status >= 200 && status < 300;

  // Deleted on the server (or already gone): the row leaves the device. A
  // create answered 410 was deleted meanwhile (another tab, another device).
  if ((op.op === 'delete' && (done || status === 404)) || (op.op === 'create' && status === 410)) {
    await db.pendingSets.delete(item.localId);
    totals.flushed += 1;
    return;
  }

  const saved = result?.set;
  if (!done || (op.op !== 'delete' && !saved)) {
    // A refused item that a retry cannot fix (closed session, unknown
    // exercise, set gone) is marked failed so it does not loop.
    await db.pendingSets.update(item.localId, {
      status: isFatalItemStatus(status) ? 'failed' : 'pending',
      attempts: (item.attempts ?? 0) + 1,
      lastError: result?.error ?? (result ? `HTTP ${status}` : 'No result for this set.'),
    });
    totals.failed += 1;
    return;
  }
  if (!saved) return;

  // Equipment is only sent on a create. The server records a stale reference
  // as null (issue #326): cleared here and reported.
  const sentEquipmentId = op.op === 'create' ? (item.gymEquipmentId ?? null) : null;
  const equipmentDropped = sentEquipmentId !== null && !saved.gymEquipmentId;

  // A newer edit or a deletion may land while the batch is in flight. Compare
  // with the current row inside one IndexedDB write transaction so nothing
  // slips between the check and the status write; a change made meanwhile
  // stays pending for the next push, now aimed at the stored row.
  await db.transaction('rw', db.pendingSets, async () => {
    const latest = await db.pendingSets.get(item.localId);
    if (!latest) return;
    const unchanged =
      latest.deletedAt == null &&
      latest.weight === item.weight &&
      latest.reps === item.reps &&
      latest.rir === item.rir &&
      (latest.rpe ?? null) === (item.rpe ?? null);
    await db.pendingSets.update(item.localId, {
      serverId: saved.id,
      lastError: null,
      ...(unchanged ? { status: 'synced', syncedAt: Date.now() } : { status: 'pending' }),
      // Written before the broadcast, so a listener that drains immediately
      // still finds the record it is being told about.
      ...(equipmentDropped
        ? { gymEquipmentId: null, equipmentDroppedNotice: sentEquipmentId }
        : {}),
    });
  });
  if (equipmentDropped && sentEquipmentId !== null) {
    totals.droppedEquipment.push({
      localId: item.localId,
      sessionId: item.sessionId,
      gymEquipmentId: sentEquipmentId,
    });
  }
  totals.flushed += 1;
}

// Helper: adds a set to the queue (status pending) and triggers a flush.
export async function queueSet(
  set: Omit<
    PendingSet,
    'createdAt' | 'status' | 'serverId' | 'syncedAt' | 'attempts' | 'lastError'
  >,
): Promise<PendingSet> {
  const db = getDB();
  const record: PendingSet = {
    ...set,
    ownerId: getOutboxOwner(),
    createdAt: Date.now(),
    status: 'pending',
    serverId: null,
    syncedAt: null,
    attempts: 0,
    lastError: null,
  };
  await db.pendingSets.add(record);
  // Kick off the flush in the background (not awaited so as not to block the UI).
  void flushPendingSets();
  return record;
}

// Deletes a set on this device at once, offline included: the row becomes a
// tombstone (hidden everywhere) until the server confirms the deletion, then
// it leaves the device. The server keeps its own tombstone, so a create of
// that set still in flight cannot bring it back.
export async function queueSetDeletion(localId: string): Promise<void> {
  const db = getDB();
  await db.pendingSets.update(localId, {
    deletedAt: Date.now(),
    status: 'pending',
    attempts: 0,
    lastError: null,
  });
  void flushPendingSets();
}

// Rows the lifter sees: everything but the deletions waiting for the server.
export function visibleSets<T extends Pick<PendingSet, 'deletedAt'>>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt == null);
}

// Returns the equipment drops recorded for `sessionId` that nobody has shown
// yet, and clears them so they are shown exactly once (issue #337).
//
// This is the single consumer of a drop. `onEquipmentDropped` stays a *signal*
// that something changed rather than the payload itself, because a flush can
// finish while no SessionRunner is mounted (log a set offline, close the app,
// reopen on the dashboard) and a broadcast with no listener was lost. Draining
// on mount picks up exactly those, and draining on the signal covers the live
// in-session case, with the clear making the two paths idempotent rather than
// double-reporting.
//
// It also removes the ordering dependency in `SessionRunner`, where
// `bindAutoSync()` runs just before `onEquipmentDropped` registers and was only
// safe because `flushPendingSets` happens to suspend at its first `await`.
//
// Read and clear happen in one `rw` transaction, and each row is claimed by the
// cursor that nulls it, so "exactly once" holds against a concurrent drain
// rather than only against a sequential one. Two drains do overlap in practice:
// `reactStrictMode` fires the mount effect twice in development, and in
// production a broadcast can land while the mount drain is mid-await. Whichever
// transaction runs second sees the field already null and returns nothing.
export async function drainDroppedEquipment(sessionId: string): Promise<DroppedEquipment[]> {
  const db = getDB();
  return db.transaction('rw', db.pendingSets, async () => {
    const notices: DroppedEquipment[] = [];
    // `modify` reads and writes each row through one cursor, so the row is read
    // out and nulled without a window in between. It writes the whole record
    // where the previous version patched one key, which is safe only because
    // the value it writes back is the one this transaction just read: an
    // `update()` from the flush path runs in its own `rw` transaction on the
    // same store, and those cannot interleave with this one.
    await db.pendingSets
      .where('sessionId')
      .equals(sessionId)
      .modify((row) => {
        if (row.equipmentDroppedNotice == null) return;
        notices.push({
          localId: row.localId,
          sessionId: row.sessionId,
          gymEquipmentId: row.equipmentDroppedNotice,
        });
        row.equipmentDroppedNotice = null;
      });
    return notices;
  });
}

// Deletes synced sets older than `maxAgeMs` to keep Dexie lightweight.
export async function pruneSyncedSets(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = getDB();
  const cutoff = Date.now() - maxAgeMs;
  return db.pendingSets
    .where('status')
    .equals('synced')
    .and((s) => (s.syncedAt ?? 0) < cutoff)
    .delete();
}

// Drops sessions whose start and finish both reached the server more than
// `maxAgeMs` ago (same retention as the synced sets).
export async function pruneSyncedSessions(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = getDB();
  const cutoff = Date.now() - maxAgeMs;
  return db.localSessions
    .filter(
      (session) =>
        session.createStatus === 'synced' &&
        session.finishStatus === 'synced' &&
        (session.finishedAt ?? 0) < cutoff,
    )
    .delete();
}

// Everything on this device that has not reached the server, whatever the
// account: what a logout must not throw away. Failed items count too: they
// are the user's training and stay visible until resolved.
export async function countUnsyncedItems(): Promise<number> {
  const db = getDB();
  const sets = await db.pendingSets.where('status').anyOf('pending', 'failed', 'syncing').count();
  const sessions = await db.localSessions
    .filter(
      (session) =>
        session.createStatus !== 'synced' ||
        session.finishStatus === 'pending' ||
        session.finishStatus === 'failed' ||
        session.swapsStatus === 'pending' ||
        session.swapsStatus === 'failed',
    )
    .count();
  return sets + sessions;
}

// Hook event listener to start/stop the auto-sync on online/offline.
// After each flush, the training pack is refreshed if it aged out (or was
// marked stale by a finish): the flush first, so the pack's last-time values
// include what was just delivered.
export function bindAutoSync(): () => void {
  if (typeof window === 'undefined') return () => {};
  const sync = () => {
    void flushPendingSets()
      .catch(() => undefined)
      .then(() => refreshTrainingPack());
  };
  window.addEventListener('online', sync);
  // First flush on mount (in case some sets remain from the previous session).
  if (navigator.onLine) {
    sync();
  }
  return () => window.removeEventListener('online', sync);
}
