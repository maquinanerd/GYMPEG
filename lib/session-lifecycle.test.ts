import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalDB, getDB } from '@/lib/indexeddb';
import { setOutboxOwner } from '@/lib/outbox-owner';
import { flushPendingSets } from '@/lib/sync';
import { finishSession, SessionStartError, startSession } from '@/lib/session-lifecycle';
import { isUuidV7 } from '@/lib/uuidv7';

// Starting and finishing a workout from the device (ADR-004): online the
// server decides (resume or create), offline the device starts the session
// itself and the outbox creates it later with the same id.

const OTHER_SESSION = '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e1f';

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

// Echoes a start back as the server would store it.
function created(body: Record<string, unknown> | null): Reply {
  return {
    status: 201,
    body: {
      id: body?.id,
      workoutId: body?.workoutId,
      gymId: body?.gymId ?? null,
      startedAt: new Date(Number(body?.startedAt)).toISOString(),
    },
  };
}

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
}

beforeEach(async () => {
  await deleteLocalDB();
  setOutboxOwner('user-1');
  setOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('startSession', () => {
  it('creates the session on the server with a device id when online', async () => {
    const calls = stubServer((route, body) => created(body));

    const started = await startSession({ workoutId: 'workout-1', gymId: 'gym-1' });

    expect(started.synced).toBe(true);
    expect(isUuidV7(started.id)).toBe(true);
    expect(calls[0]!.body).toMatchObject({
      id: started.id,
      workoutId: 'workout-1',
      gymId: 'gym-1',
      resumeOpen: true,
    });
    expect(await getDB().localSessions.get(started.id)).toMatchObject({
      ownerId: 'user-1',
      createStatus: 'synced',
      finishStatus: 'none',
    });
  });

  it('resumes the unfinished session the server offers', async () => {
    stubServer(() => ({
      status: 200,
      body: {
        id: OTHER_SESSION,
        workoutId: 'workout-1',
        gymId: null,
        startedAt: '2026-10-09T10:00:00.000Z',
      },
    }));

    const started = await startSession({ workoutId: 'workout-1', gymId: null });

    expect(started).toEqual({ id: OTHER_SESSION, synced: true });
  });

  it('starts on the device when the request fails, and the outbox creates it with that id', async () => {
    let reachable = false;
    const calls = stubServer((route, body) => (reachable ? created(body) : 'network-error'));

    const started = await startSession({ workoutId: 'workout-1', gymId: null });
    expect(started.synced).toBe(false);
    expect((await getDB().localSessions.get(started.id))?.createStatus).toBe('pending');

    reachable = true;
    await flushPendingSets();

    const replay = calls.at(-1)!;
    expect(replay.route).toBe('POST /api/sessions');
    expect(replay.body).toMatchObject({ id: started.id, workoutId: 'workout-1' });
    // A replay never resumes another session: its sets point to this id.
    expect(replay.body).not.toHaveProperty('resumeOpen');
    expect((await getDB().localSessions.get(started.id))?.createStatus).toBe('synced');
  });

  it('starts on the device when offline and resumes that session on the next start', async () => {
    setOnline(false);
    const calls = stubServer(() => ok());

    const first = await startSession({ workoutId: 'workout-1', gymId: null });
    const again = await startSession({ workoutId: 'workout-1', gymId: null });

    expect(calls).toEqual([]);
    expect(first.synced).toBe(false);
    expect(again.id).toBe(first.id);
  });

  it('refuses when the server rejects the start, keeping nothing on the device', async () => {
    stubServer(() => ({ status: 404, body: { error: 'Session not found.' } }));

    await expect(startSession({ workoutId: 'gone', gymId: null })).rejects.toBeInstanceOf(
      SessionStartError,
    );
    expect(await getDB().localSessions.count()).toBe(0);
  });

  it('does not resume a session this device already finished', async () => {
    await getDB().localSessions.add({
      id: OTHER_SESSION,
      ownerId: 'user-1',
      workoutId: 'workout-1',
      gymId: null,
      startedAt: 1_000,
      finishedAt: 2_000,
      notes: null,
      createStatus: 'synced',
      // The finish keeps failing on the server, so it still offers the session.
      finishStatus: 'pending',
      attempts: 0,
      lastError: null,
    });
    const calls = stubServer((route, body) => {
      if (route.startsWith('PUT')) return { status: 503 };
      if (body?.resumeOpen) {
        return {
          status: 200,
          body: {
            id: OTHER_SESSION,
            workoutId: 'workout-1',
            gymId: null,
            startedAt: '2026-10-09T10:00:00.000Z',
          },
        };
      }
      return created(body);
    });

    const started = await startSession({ workoutId: 'workout-1', gymId: null });

    expect(started.id).not.toBe(OTHER_SESSION);
    expect(calls.filter((call) => call.route === 'POST /api/sessions')).toHaveLength(2);
  });
});

describe('finishSession', () => {
  const session = {
    id: OTHER_SESSION,
    workoutId: 'workout-1',
    gymId: null,
    startedAt: Date.parse('2026-10-09T10:00:00.000Z'),
  };

  it('finishes on the device while offline and sends the finish once online', async () => {
    setOnline(false);
    const calls = stubServer(() => ok());

    const offline = await finishSession(session, 'last set was hard');
    expect(offline.synced).toBe(false);
    expect(calls).toEqual([]);
    const local = await getDB().localSessions.get(OTHER_SESSION);
    expect(local).toMatchObject({ finishStatus: 'pending', createStatus: 'synced' });
    expect(local?.finishedAt).toEqual(expect.any(Number));

    setOnline(true);
    await flushPendingSets();

    expect(calls).toEqual([
      {
        route: `PUT /api/sessions/${OTHER_SESSION}`,
        body: { finish: true, finishedAt: local!.finishedAt, notes: 'last set was hard' },
      },
    ]);
    expect((await getDB().localSessions.get(OTHER_SESSION))?.finishStatus).toBe('synced');
  });

  it('reports a finish that reached the server at once', async () => {
    stubServer(() => ok());

    expect(await finishSession(session, null)).toEqual({ synced: true });
  });

  it('keeps the first finish time when finished twice', async () => {
    setOnline(false);
    stubServer(() => ok());
    await finishSession(session, null);
    const first = (await getDB().localSessions.get(OTHER_SESSION))!.finishedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await finishSession(session, null);

    expect((await getDB().localSessions.get(OTHER_SESSION))!.finishedAt).toBe(first);
  });
});

function ok(): Reply {
  return { status: 200, body: {} };
}
