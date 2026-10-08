import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Set as PrismaSet } from '@/lib/prisma-client';
import type { PendingSet } from '@/lib/indexeddb';

const { mockGetDB } = vi.hoisted(() => ({ mockGetDB: vi.fn() }));
vi.mock('@/lib/indexeddb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/indexeddb')>();
  return { ...actual, getDB: mockGetDB };
});

import { hydrateFromServerSets } from './sync-hydration';

// In-memory stand-in for the pendingSets table with the calls hydration uses.
function memoryDB(rows: PendingSet[]) {
  const store = new Map(rows.map((r) => [r.localId, { ...r }]));
  const pendingSets = {
    where: (_index: string) => ({
      equals: (value: string) => ({
        toArray: async () => [...store.values()].filter((r) => r.sessionId === value),
      }),
    }),
    bulkDelete: async (ids: string[]) => ids.forEach((id) => store.delete(id)),
    bulkPut: async (items: PendingSet[]) => items.forEach((i) => store.set(i.localId, i)),
    put: async (item: PendingSet) => void store.set(item.localId, item),
    update: async (id: string, patch: Partial<PendingSet>) => {
      const row = store.get(id);
      if (row) Object.assign(row, patch);
    },
  };
  return {
    store,
    db: {
      pendingSets,
      transaction: async (_mode: string, _table: unknown, body: () => Promise<void>) => body(),
    },
  };
}

function localRow(over: Partial<PendingSet>): PendingSet {
  return {
    localId: 'loc_aaaa1111',
    sessionId: 'sess-1',
    exerciseId: 'ex-1',
    setNumber: 1,
    weight: 80,
    reps: 8,
    rir: 2,
    notes: null,
    isWarmup: false,
    isDropSet: false,
    createdAt: 1,
    status: 'synced',
    serverId: 'set-1',
    syncedAt: 1,
    attempts: 0,
    lastError: null,
    ...over,
  };
}

function serverSet(over: Partial<PrismaSet>): PrismaSet {
  return {
    id: 'set-1',
    sessionId: 'sess-1',
    exerciseId: 'ex-1',
    gymEquipmentId: null,
    setNumber: 1,
    weight: 80,
    reps: 8,
    rir: 2,
    durationSec: null,
    distanceM: null,
    avgHr: null,
    maxHr: null,
    track: null,
    notes: null,
    isWarmup: false,
    isDropSet: false,
    completedAt: new Date('2026-10-09T10:00:00Z'),
    clientMutationId: 'loc_aaaa1111',
    receivedAt: new Date('2026-10-09T10:00:01Z'),
    equipmentNameSnapshot: null,
    equipmentLoadSnapshot: null,
    ...over,
  } as PrismaSet;
}

describe('hydrateFromServerSets', () => {
  beforeEach(() => mockGetDB.mockReset());

  it('does not duplicate a set this device logged (reload mid-session)', async () => {
    const { db, store } = memoryDB([localRow({})]);
    mockGetDB.mockReturnValue(db);

    await hydrateFromServerSets('sess-1', [serverSet({})]);
    await hydrateFromServerSets('sess-1', [serverSet({})]);

    expect([...store.keys()]).toEqual(['loc_aaaa1111']);
  });

  it('binds a pending row whose POST succeeded but whose response was lost', async () => {
    const { db, store } = memoryDB([localRow({ status: 'pending', serverId: null })]);
    mockGetDB.mockReturnValue(db);

    await hydrateFromServerSets('sess-1', [serverSet({})]);

    expect(store.size).toBe(1);
    expect(store.get('loc_aaaa1111')).toMatchObject({ serverId: 'set-1', status: 'pending' });
  });

  it('keeps a pending local edit instead of the server values', async () => {
    const { db, store } = memoryDB([localRow({ status: 'pending', weight: 85 })]);
    mockGetDB.mockReturnValue(db);

    await hydrateFromServerSets('sess-1', [serverSet({ weight: 80 })]);

    expect(store.get('loc_aaaa1111')!.weight).toBe(85);
  });

  it('adds sets logged on another device and refreshes settled ones', async () => {
    const { db, store } = memoryDB([localRow({ weight: 80 })]);
    mockGetDB.mockReturnValue(db);

    await hydrateFromServerSets('sess-1', [
      serverSet({ weight: 82.5 }),
      serverSet({ id: 'set-2', setNumber: 2, clientMutationId: 'loc_other999' }),
    ]);

    expect(store.get('loc_aaaa1111')!.weight).toBe(82.5);
    expect(store.get('srv_set-2')).toMatchObject({ serverId: 'set-2', status: 'synced' });
  });

  it('cleans up duplicates left by the old hydration, keeping the device row', async () => {
    const { db, store } = memoryDB([localRow({}), localRow({ localId: 'srv_set-1' })]);
    mockGetDB.mockReturnValue(db);

    await hydrateFromServerSets('sess-1', [serverSet({})]);

    expect([...store.keys()]).toEqual(['loc_aaaa1111']);
  });
});
