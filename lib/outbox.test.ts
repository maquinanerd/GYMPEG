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

function stubServer(reply: (route: string) => Reply) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const route = `${init.method ?? 'GET'} ${url}`;
      calls.push({ route, body: init.body ? JSON.parse(String(init.body)) : null });
      const answer = reply(route);
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

beforeEach(async () => {
  await deleteLocalDB();
  setOutboxOwner('user-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('offline outbox', () => {
  it('creates a session started offline before its sets, and finishes it after them', async () => {
    await getDB().localSessions.add(
      localSession({ finishedAt: 5_000, notes: 'felt strong', finishStatus: 'pending' }),
    );
    await getDB().pendingSets.add(pendingSet());
    const calls = stubServer((route) =>
      route === `POST /api/sessions/${SESSION_ID}/sets` ? ok({ id: 'server-set-1' }) : ok(),
    );

    await flushPendingSets();

    expect(calls.map((call) => call.route)).toEqual([
      'POST /api/sessions',
      `POST /api/sessions/${SESSION_ID}/sets`,
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
      serverId: 'server-set-1',
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

    expect(calls.map((call) => call.route)).toEqual([`POST /api/sessions/${SESSION_ID}/sets`]);
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
      `POST /api/sessions/${SESSION_ID}/sets`,
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
    const calls = stubServer(() => ok({ id: 'server-set' }));

    await flushPendingSets();

    // The row queued before the outbox was scoped goes to whoever is signed in.
    expect(calls.map((call) => call.route)).toEqual(['POST /api/sessions/server-session/sets']);
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
