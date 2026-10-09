import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalDB, getDB, type PendingSet } from '@/lib/indexeddb';
import { setOutboxOwner } from '@/lib/outbox-owner';
import type { BatchItem, BatchItemResult } from '@/lib/set-batch';
import {
  drainDroppedEquipment,
  flushPendingSets,
  onEquipmentDropped,
  pendingSetUpdateState,
  queueSetDeletion,
  visibleSets,
} from '@/lib/sync';

// The set outbox on a real IndexedDB (fake-indexeddb) against a stubbed batch
// endpoint (ADR-004): one batch per session, one result per item, deletions
// as tombstones that leave the device once the server confirms.

const SESSION = 'session-1';
const BATCH_ROUTE = `POST /api/sessions/${SESSION}/sets/batch`;

function pendingSet(overrides: Partial<PendingSet> = {}): PendingSet {
  return {
    localId: 'loc_set00000001',
    sessionId: SESSION,
    exerciseId: 'exercise-1',
    gymEquipmentId: 'stale-equipment',
    setNumber: 1,
    weight: 82.5,
    reps: 7,
    rir: 2,
    notes: 'offline set',
    isWarmup: false,
    isDropSet: false,
    ownerId: 'user-1',
    createdAt: 1,
    status: 'pending',
    serverId: null,
    syncedAt: null,
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

type Reply =
  | { status: number; body?: unknown }
  | ((items: BatchItem[]) => BatchItemResult[] | Promise<BatchItemResult[]>)
  | 'network-error';

// Answers each request with the next reply (the last one repeats) and records
// what was sent.
function stubServer(...replies: Reply[]) {
  const batches: BatchItem[][] = [];
  const routes: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      routes.push(`${init.method ?? 'GET'} ${url}`);
      const items = (JSON.parse(String(init.body ?? '{}')) as { items?: BatchItem[] }).items ?? [];
      batches.push(items);
      const reply = replies[Math.min(batches.length - 1, replies.length - 1)]!;
      if (reply === 'network-error') throw new TypeError('Failed to fetch');
      if (typeof reply === 'function') {
        return new Response(JSON.stringify({ results: await reply(items) }), { status: 200 });
      }
      return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status });
    }),
  );
  return { batches, routes };
}

// Every item succeeds; creates get `server-<key>` ids.
const allOk =
  (extra: Partial<BatchItemResult['set']> = {}) =>
  (items: BatchItem[]): BatchItemResult[] =>
    items.map((item) => ({
      key: item.key,
      status: item.op === 'create' ? 201 : 200,
      ...(item.op === 'delete'
        ? {}
        : { set: { id: item.op === 'update' ? item.setId : `server-${item.key}`, ...extra } }),
    }));

const row = (localId = 'loc_set00000001') => getDB().pendingSets.get(localId);

beforeEach(async () => {
  await deleteLocalDB();
  setOutboxOwner('user-1');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pendingSetUpdateState', () => {
  it('distinguishes remote persistence from queued and fatal states', () => {
    expect(pendingSetUpdateState(undefined)).toBe('missing');
    expect(pendingSetUpdateState(pendingSet({ status: 'failed' }))).toBe('failed');
    expect(pendingSetUpdateState(pendingSet({ status: 'synced' }))).toBe('synced');
    expect(pendingSetUpdateState(pendingSet({ status: 'pending' }))).toBe('queued');
    expect(pendingSetUpdateState(pendingSet({ status: 'syncing' }))).toBe('queued');
  });
});

describe('batched set push', () => {
  it('sends the sets of a session in one batch, keyed by the local id', async () => {
    await getDB().pendingSets.bulkAdd([
      pendingSet({ gymEquipmentId: null, createdAt: 1_760_000_000_000 }),
      pendingSet({
        localId: 'loc_set00000002',
        gymEquipmentId: null,
        setNumber: 2,
        createdAt: 1_760_000_000_500,
      }),
    ]);
    const { batches, routes } = stubServer(allOk());

    const result = await flushPendingSets();

    expect(routes).toEqual([BATCH_ROUTE]);
    expect(batches[0]!.map((item) => [item.op, item.key])).toEqual([
      ['create', 'loc_set00000001'],
      ['create', 'loc_set00000002'],
    ]);
    const first = batches[0]![0] as Extract<BatchItem, { op: 'create' }>;
    expect(first.set).toMatchObject({
      clientMutationId: 'loc_set00000001',
      performedAt: 1_760_000_000_000,
      weight: 82.5,
      reps: 7,
    });
    expect(await row()).toMatchObject({ status: 'synced', serverId: 'server-loc_set00000001' });
    expect(result).toMatchObject({ flushed: 2, failed: 0, pending: 0 });
  });

  it('resends a set left in syncing by a closed tab', async () => {
    await getDB().pendingSets.add(pendingSet({ gymEquipmentId: null, status: 'syncing' }));
    stubServer(allOk());

    await flushPendingSets();

    expect((await row())?.status).toBe('synced');
  });

  it('corrects a stored set instead of creating a duplicate', async () => {
    await getDB().pendingSets.add(
      pendingSet({ serverId: 'server-1', syncedAt: 1, weight: 95, reps: 9, rir: 1 }),
    );
    const { batches } = stubServer(allOk());

    await flushPendingSets();

    expect(batches[0]).toEqual([
      {
        op: 'update',
        key: 'loc_set00000001',
        setId: 'server-1',
        patch: { weight: 95, reps: 9, rir: 1 },
      },
    ]);
    expect((await row())?.status).toBe('synced');
  });

  it('keeps a newer local edit pending when an older correction completes', async () => {
    await getDB().pendingSets.add(pendingSet({ serverId: 'server-1', syncedAt: 1, weight: 95 }));
    stubServer(async (items) => {
      // A second edit lands while the first correction is in flight.
      await getDB().pendingSets.update('loc_set00000001', { weight: 97.5, status: 'pending' });
      return allOk()(items);
    });

    const result = await flushPendingSets();

    expect(await row()).toMatchObject({ weight: 97.5, status: 'pending', serverId: 'server-1' });
    expect(result).toMatchObject({ flushed: 1, pending: 1 });
  });

  it('gives each item its own result: one refused set does not sink the others', async () => {
    await getDB().pendingSets.bulkAdd([
      pendingSet({ gymEquipmentId: null }),
      pendingSet({ localId: 'loc_set00000002', gymEquipmentId: null, createdAt: 2 }),
    ]);
    stubServer((items) => [
      { key: items[0]!.key, status: 201, set: { id: 'server-1' } },
      { key: items[1]!.key, status: 400, error: 'Invalid exercise.' },
    ]);

    const result = await flushPendingSets();

    expect((await row())?.status).toBe('synced');
    expect(await row('loc_set00000002')).toMatchObject({
      status: 'failed',
      lastError: 'Invalid exercise.',
      attempts: 1,
    });
    expect(result).toMatchObject({ flushed: 1, failed: 1 });
  });

  it('keeps everything pending when the batch cannot reach the server', async () => {
    await getDB().pendingSets.add(pendingSet({ gymEquipmentId: null }));
    stubServer('network-error');

    await flushPendingSets();

    expect(await row()).toMatchObject({ status: 'pending', attempts: 1 });
  });

  it('marks the items failed when the server refuses the whole batch', async () => {
    await getDB().pendingSets.add(pendingSet({ gymEquipmentId: null }));
    stubServer({ status: 404, body: { error: 'Session not found.' } });

    await flushPendingSets();

    expect(await row()).toMatchObject({ status: 'failed', lastError: 'Session not found.' });
  });

  it('runs once more for a change queued while a flush was running', async () => {
    await getDB().pendingSets.add(pendingSet({ gymEquipmentId: null }));
    let second: Promise<unknown> | null = null;
    const { batches } = stubServer(async (items) => {
      if (!second) {
        await getDB().pendingSets.add(
          pendingSet({ localId: 'loc_set00000002', gymEquipmentId: null, createdAt: 2 }),
        );
        second = flushPendingSets();
      }
      return allOk()(items);
    });

    await flushPendingSets();
    await second;

    expect(batches.map((batch) => batch.map((item) => item.key))).toEqual([
      ['loc_set00000001'],
      ['loc_set00000002'],
    ]);
    expect((await row('loc_set00000002'))?.status).toBe('synced');
  });
});

describe('deleting a set (tombstone)', () => {
  it('hides the set at once and removes it after the server confirms', async () => {
    await getDB().pendingSets.add(
      pendingSet({ status: 'synced', serverId: 'server-1', syncedAt: 1 }),
    );
    const { batches } = stubServer('network-error');

    await queueSetDeletion('loc_set00000001');
    await flushPendingSets();

    // Offline: still on the device, hidden, waiting.
    const waiting = await row();
    expect(waiting).toMatchObject({ status: 'pending' });
    expect(visibleSets([waiting!])).toEqual([]);
    expect(batches[0]).toEqual([
      {
        op: 'delete',
        key: 'loc_set00000001',
        setId: 'server-1',
        clientMutationId: 'loc_set00000001',
      },
    ]);

    stubServer(allOk());
    await flushPendingSets();
    expect(await row()).toBeUndefined();
  });

  it('deletes by device key a set whose server id the device never learned', async () => {
    await getDB().pendingSets.add(pendingSet({ status: 'failed', gymEquipmentId: null }));
    const { batches } = stubServer(allOk());

    await queueSetDeletion('loc_set00000001');
    await flushPendingSets();

    expect(batches.at(-1)).toEqual([
      { op: 'delete', key: 'loc_set00000001', clientMutationId: 'loc_set00000001' },
    ]);
    expect(await row()).toBeUndefined();
  });

  it('never sends a device key for a set hydrated from the server', async () => {
    await getDB().pendingSets.add(
      pendingSet({ localId: 'srv_abc', status: 'synced', serverId: 'abc', syncedAt: 1 }),
    );
    const { batches } = stubServer(allOk());

    await queueSetDeletion('srv_abc');
    await flushPendingSets();

    expect(batches.at(-1)).toEqual([{ op: 'delete', key: 'srv_abc', setId: 'abc' }]);
  });

  it('follows a create with the deletion made while it was in flight', async () => {
    await getDB().pendingSets.add(pendingSet({ gymEquipmentId: null }));
    const { batches } = stubServer(async (items) => {
      if (batches.length === 1) {
        await getDB().pendingSets.update('loc_set00000001', {
          deletedAt: Date.now(),
          status: 'pending',
        });
      }
      return allOk()(items);
    });

    await flushPendingSets();
    expect(await row()).toMatchObject({ status: 'pending', serverId: 'server-loc_set00000001' });

    await flushPendingSets();
    expect(batches.at(-1)).toEqual([
      {
        op: 'delete',
        key: 'loc_set00000001',
        setId: 'server-loc_set00000001',
        clientMutationId: 'loc_set00000001',
      },
    ]);
    expect(await row()).toBeUndefined();
  });

  it('drops a set the server says was deleted meanwhile', async () => {
    await getDB().pendingSets.add(pendingSet({ gymEquipmentId: null }));
    stubServer((items) => [{ key: items[0]!.key, status: 410, error: 'This set was deleted.' }]);

    await flushPendingSets();

    expect(await row()).toBeUndefined();
  });
});

describe('equipment references (issue #326)', () => {
  it('retries a 400 once without stale optional equipment and preserves the training set', async () => {
    await getDB().pendingSets.add(pendingSet());
    const { batches } = stubServer(
      (items) => [{ key: items[0]!.key, status: 400, error: 'Equipment is not available.' }],
      (items) => [{ key: items[0]!.key, status: 201, set: { id: 'server-set-1' } }],
    );

    const result = await flushPendingSets();

    const sentEquipment = batches.map(
      (batch) => (batch[0] as Extract<BatchItem, { op: 'create' }>).set.gymEquipmentId,
    );
    expect(sentEquipment).toEqual(['stale-equipment', null]);
    expect(await row()).toMatchObject({
      status: 'synced',
      serverId: 'server-set-1',
      gymEquipmentId: null,
    });
    expect(result).toEqual({
      flushed: 1,
      failed: 0,
      pending: 0,
      droppedEquipment: [
        { localId: 'loc_set00000001', sessionId: SESSION, gymEquipmentId: 'stale-equipment' },
      ],
    });
  });

  it('clears and reports an equipment reference the server recorded as null', async () => {
    await getDB().pendingSets.add(pendingSet());
    stubServer(allOk({ gymEquipmentId: null }));
    const listener = vi.fn();
    const unsubscribe = onEquipmentDropped(listener);

    const result = await flushPendingSets();
    unsubscribe();

    expect(await row()).toMatchObject({ status: 'synced', gymEquipmentId: null });
    expect(result.droppedEquipment).toEqual([
      { localId: 'loc_set00000001', sessionId: SESSION, gymEquipmentId: 'stale-equipment' },
    ]);
    expect(listener).toHaveBeenCalledWith(result.droppedEquipment);
  });

  it('keeps an equipment reference the server attached and stays silent', async () => {
    await getDB().pendingSets.add(pendingSet());
    stubServer(allOk({ gymEquipmentId: 'stale-equipment' }));
    const listener = vi.fn();
    const unsubscribe = onEquipmentDropped(listener);

    const result = await flushPendingSets();
    unsubscribe();

    expect((await row())?.gymEquipmentId).toBe('stale-equipment');
    expect(result.droppedEquipment).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not report a set that never carried an equipment reference', async () => {
    await getDB().pendingSets.add(pendingSet({ gymEquipmentId: null }));
    stubServer(allOk({ gymEquipmentId: null }));

    const result = await flushPendingSets();

    expect(result.droppedEquipment).toEqual([]);
  });
});

// Issue #337: the notice was broadcast to live subscribers only, so a flush
// that completed with no SessionRunner mounted told nobody and was gone.
describe('dropped equipment survives a flush nobody was listening to', () => {
  async function flushWithDropAndNoListener() {
    await getDB().pendingSets.add(pendingSet());
    stubServer(allOk({ gymEquipmentId: null }));
    return flushPendingSets();
  }

  it('records the drop on the set and hands it to a runner that mounts afterwards', async () => {
    await flushWithDropAndNoListener();

    expect(await row()).toMatchObject({
      gymEquipmentId: null,
      equipmentDroppedNotice: 'stale-equipment',
    });
    expect(await drainDroppedEquipment(SESSION)).toEqual([
      { localId: 'loc_set00000001', sessionId: SESSION, gymEquipmentId: 'stale-equipment' },
    ]);
  });

  it('shows it exactly once, even with two drains at once', async () => {
    await flushWithDropAndNoListener();

    const [mount, broadcast] = await Promise.all([
      drainDroppedEquipment(SESSION),
      drainDroppedEquipment(SESSION),
    ]);

    expect([...mount, ...broadcast]).toHaveLength(1);
    expect(await drainDroppedEquipment(SESSION)).toEqual([]);
    expect((await row())?.equipmentDroppedNotice).toBeNull();
  });

  it('does not hand one session the drops of another', async () => {
    await flushWithDropAndNoListener();

    expect(await drainDroppedEquipment('another-session')).toEqual([]);
    expect((await row())?.equipmentDroppedNotice).toBe('stale-equipment');
  });
});
