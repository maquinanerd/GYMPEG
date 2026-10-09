import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalDB, getDB, type LocalSession, type PendingSet } from '@/lib/indexeddb';
import { setOutboxOwner } from '@/lib/outbox-owner';
import { countUnsyncedItems, flushPendingSets } from '@/lib/sync';

// Offline outbox order (ADR-004) on a real IndexedDB (fake-indexeddb): the
// start of a session made offline goes first, then its sets, then its finish,
// and only the signed-in account's items are sent.

const SESSION_ID = '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e1f';

type Call = { route: string; body: Record<string, unknown> | null };
type Reply = { status: number; body?: unknown } | 'network-error';

function stubServer(reply: (route: string, body: Record<string, unknown> | null) => Reply) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const route = `${init.method ?? 'GET'} ${url}`;
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ route, body });
      const answer = reply(route, body);
      if (answer === 'network-error') throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status });
    }),
  );
  return calls;
}

function localSession(overrides: Partial<LocalSession> = {}): LocalSession {
  return {
    id: SESSION_ID,
    ownerId: 'user-1',
    workoutId: 'workout-1',
    gymId: null,
    startedAt: 1_000,
    finishedAt: null,
    notes: null,
    createStatus: 'pending',
    finishStatus: 'none',
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

function pendingSet(overrides: Partial<PendingSet> = {}): PendingSet {
  return {
    localId: 'loc_set00000001',
    sessionId: SESSION_ID,
    exerciseId: 'exercise-1',
    setNumber: 1,
    weight: 80,
    reps: 8,
    rir: 2,
    notes: null,
    isWarmup: false,
    isDropSet: false,
    ownerId: 'user-1',
    createdAt: 2_000,
    status: 'pending',
    serverId: null,
    syncedAt: null,
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

const ok = (body: unknown = {}): Reply => ({ status: 200, body });

// Batched set push: every item is stored, under `server-<key>`.
const batchOk = (body: Record<string, unknown> | null): Reply =>
  ok({
    results: ((body?.items ?? []) as { key: string }[]).map((item) => ({
      key: item.key,
      status: 201,
      set: { id: `server-${item.key}` },
    })),
  });
const isBatch = (route: string) => route.endsWith('/sets/batch');

beforeEach(async () => {
  await deleteLocalDB();
  setOutboxOwner('user-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline outbox', () => {
  it('sends replaced exercises after the start and before the sets', async () => {
    await getDB().localSessions.add(
      localSession({ exerciseSwaps: { 'pe-1': 'exercise-2' }, swapsStatus: 'pending' }),
    );
    await getDB().pendingSets.add(pendingSet({ exerciseId: 'exercise-2' }));
    const calls = stubServer((route, body) => (isBatch(route) ? batchOk(body) : ok()));

    await flushPendingSets();

    expect(calls.map((call) => call.route)).toEqual([
      'POST /api/sessions',
      `PUT /api/sessions/${SESSION_ID}`,
      `POST /api/sessions/${SESSION_ID}/sets/batch`,
    ]);
    expect(calls[1]!.body).toEqual({ exerciseSwaps: { 'pe-1': 'exercise-2' } });
    expect((await getDB().localSessions.get(SESSION_ID))?.swapsStatus).toBe('synced');
  });

  it('keeps a swap made while the previous one was being sent waiting', async () => {
    await getDB().localSessions.add(
      localSession({
        createStatus: 'synced',
        exerciseSwaps: { 'pe-1': 'exercise-2' },
        swapsStatus: 'pending',
      }),
    );
    stubServer(() => ok());
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(async (...args) => {
      // A second swap lands while the first PUT is in flight.
      await getDB().localSessions.update(SESSION_ID, {
        exerciseSwaps: { 'pe-1': 'exercise-2', 'pe-2': 'exercise-3' },
      });
      return original(...args);
    });

    await flushPendingSets();

    expect((await getDB().localSessions.get(SESSION_ID))?.swapsStatus).toBe('pending');
  });

  it('creates a session started offline before its sets, and finishes it after them', async () => {
    await getDB().localSessions.add(
      localSession({ finishedAt: 5_000, notes: 'felt strong', finishStatus: 'pending' }),
    );
    await getDB().pendingSets.add(pendingSet());
    const calls = stubServer((route, body) => (isBatch(route) ? batchOk(body) : ok()));

    await flushPendingSets();

    expect(calls.map((call) => call.route)).toEqual([
      'POST /api/sessions',
      `POST /api/sessions/${SESSION_ID}/sets/batch`,
      `PUT /api/sessions/${SESSION_ID}`,
    ]);
    expect(calls[0]!.body).toEqual({
      id: SESSION_ID,
      workoutId: 'workout-1',
      gymId: null,
      startedAt: 1_000,
    });
    expect(calls[2]!.body).toEqual({ finish: true, finishedAt: 5_000, notes: 'felt strong' });
    const stored = await getDB().localSessions.get(SESSION_ID);
    expect(stored).toMatchObject({ createStatus: 'synced', finishStatus: 'synced' });
    expect(await getDB().pendingSets.get('loc_set00000001')).toMatchObject({
      status: 'synced',
      serverId: 'server-loc_set00000001',
    });
  });

  it('keeps the sets waiting while their session cannot reach the server', async () => {
    await getDB().localSessions.add(localSession());
    await getDB().pendingSets.add(pendingSet());
    const calls = stubServer(() => 'network-error');

    await flushPendingSets();

    expect(calls.map((call) => call.route)).toEqual(['POST /api/sessions']);
    expect(await getDB().localSessions.get(SESSION_ID)).toMatchObject({
      createStatus: 'pending',
      attempts: 1,
    });
    expect((await getDB().pendingSets.get('loc_set00000001'))?.status).toBe('pending');
  });

  it('holds the finish until every set of the session is sent', async () => {
    await getDB().localSessions.add(
      localSession({ createStatus: 'synced', finishedAt: 5_000, finishStatus: 'pending' }),
    );
    await getDB().pendingSets.add(pendingSet());
    const calls = stubServer((route) => (route.startsWith('POST') ? { status: 503 } : ok()));

    await flushPendingSets();

    expect(calls.map((call) => call.route)).toEqual([
      `POST /api/sessions/${SESSION_ID}/sets/batch`,
    ]);
    expect((await getDB().localSessions.get(SESSION_ID))?.finishStatus).toBe('pending');
  });

  it('does not let a permanently refused set block the finish', async () => {
    await getDB().localSessions.add(
      localSession({ createStatus: 'synced', finishedAt: 5_000, finishStatus: 'pending' }),
    );
    await getDB().pendingSets.add(pendingSet());
    const calls = stubServer((route) => (route.startsWith('POST') ? { status: 400 } : ok()));

    await flushPendingSets();

    expect(calls.map((call) => call.route)).toEqual([
      `POST /api/sessions/${SESSION_ID}/sets/batch`,
      `PUT /api/sessions/${SESSION_ID}`,
    ]);
    expect((await getDB().pendingSets.get('loc_set00000001'))?.status).toBe('failed');
  });

  it('marks a start the server refuses as failed instead of retrying it forever', async () => {
    await getDB().localSessions.add(localSession());
    stubServer(() => ({ status: 404, body: { error: 'Session not found.' } }));

    await flushPendingSets();

    expect(await getDB().localSessions.get(SESSION_ID)).toMatchObject({
      createStatus: 'failed',
      lastError: 'Session not found.',
    });
  });

  it("sends only the signed-in account's items and keeps the others on the device", async () => {
    await getDB().localSessions.add(localSession({ ownerId: 'user-2' }));
    await getDB().pendingSets.bulkAdd([
      pendingSet({ localId: 'loc_other0000001', ownerId: 'user-2' }),
      pendingSet({ localId: 'loc_legacy000001', sessionId: 'server-session', ownerId: undefined }),
    ]);
    const calls = stubServer((route, body) => (isBatch(route) ? batchOk(body) : ok()));

    await flushPendingSets();

    // The row queued before the outbox was scoped goes to whoever is signed in.
    expect(calls.map((call) => call.route)).toEqual([
      'POST /api/sessions/server-session/sets/batch',
    ]);
    expect((await getDB().pendingSets.get('loc_other0000001'))?.status).toBe('pending');
    expect((await getDB().localSessions.get(SESSION_ID))?.createStatus).toBe('pending');
    // A logout must keep them: they are counted whatever the account.
    expect(await countUnsyncedItems()).toBe(2);
  });

  it('sends nothing owned while no account is known on the device', async () => {
    setOutboxOwner(null);
    await getDB().localSessions.add(localSession());
    await getDB().pendingSets.add(pendingSet());
    const calls = stubServer(() => ok());

    await flushPendingSets();

    expect(calls).toEqual([]);
  });
});
