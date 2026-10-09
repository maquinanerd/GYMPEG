// Starting and finishing a workout session from the device (ADR-004): both
// work without a network. The device writes the session to the outbox first
// (lib/indexeddb localSessions) and the flush sends it when it can.
//
// Client-only, like lib/indexeddb.

import { getDB, type LocalSession } from '@/lib/indexeddb';
import { getOutboxOwner } from '@/lib/outbox-owner';
import { flushPendingSets } from '@/lib/sync';
import { markTrainingPackStale, refreshTrainingPack } from '@/lib/training-pack';
import { uuidv7 } from '@/lib/uuidv7';

// The lifter is waiting on the Start button: a slow network falls back to an
// offline start quickly instead of hanging for the outbox timeout.
const LIVE_START_TIMEOUT_MS = 6_000;

export class SessionStartError extends Error {
  constructor(readonly status: number) {
    super(`Session start refused (HTTP ${status}).`);
  }
}

export interface StartedSession {
  id: string;
  // True when the session exists on the server: its page can be rendered by
  // the server. False for a session that so far exists only on this device.
  synced: boolean;
}

interface ServerSession {
  id: string;
  workoutId: string | null;
  gymId: string | null;
  startedAt: string;
}

function requireOwner(): string {
  const owner = getOutboxOwner();
  if (!owner) throw new Error('No signed-in account on this device.');
  return owner;
}

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function liveTimeout(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(LIVE_START_TIMEOUT_MS)
    : undefined;
}

// The unfinished session of this workout recorded on this device, if any.
async function openLocalSession(workoutId: string, ownerId: string) {
  return getDB()
    .localSessions.where('workoutId')
    .equals(workoutId)
    .filter(
      (session) =>
        session.ownerId === ownerId &&
        session.finishedAt == null &&
        session.createStatus !== 'failed',
    )
    .first();
}

async function postLiveStart(body: Record<string, unknown>): Promise<Response> {
  return fetch('/api/sessions', {
    method: 'POST',
    signal: liveTimeout(),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Starts (or resumes) a session on `workoutId`.
//
// - A session started here while offline and not on the server yet is
//   resumed: the server does not know it.
// - Online: the server resumes an unfinished session of the workout or
//   creates one with a device id. A network failure falls back to an offline
//   start that reuses that id, so if the request did reach the server the
//   later replay finds the same session instead of creating a second one.
// - Offline: resumes the open session known here, or starts one on the device.
export async function startSession(input: {
  workoutId: string;
  gymId: string | null;
}): Promise<StartedSession> {
  const ownerId = requireOwner();
  const db = getDB();
  // Finishes and starts queued earlier go first, so the server's view of
  // "unfinished session on this workout" is current.
  if (online()) await flushPendingSets();

  const openHere = await openLocalSession(input.workoutId, ownerId);
  if (openHere && openHere.createStatus === 'pending') {
    return { id: openHere.id, synced: false };
  }

  const id = uuidv7();
  const startedAt = Date.now();

  if (online()) {
    try {
      const body = { workoutId: input.workoutId, gymId: input.gymId, id, startedAt };
      let res = await postLiveStart({ ...body, resumeOpen: true });
      if (res.ok) {
        let server = (await res.json()) as ServerSession;
        // The server offered a session this device already finished (its
        // finish has not reached the server yet): start a new one instead.
        const local = await db.localSessions.get(server.id);
        if (server.id !== id && local?.finishedAt != null) {
          res = await postLiveStart(body);
          if (!res.ok) throw new SessionStartError(res.status);
          server = (await res.json()) as ServerSession;
        }
        await recordServerSession(server, ownerId, input.workoutId);
        return { id: server.id, synced: true };
      }
      // Refused (workout deleted, signed out): retrying offline would not help.
      if (res.status < 500) throw new SessionStartError(res.status);
    } catch (err) {
      if (err instanceof SessionStartError) throw err;
      // Network failure or timeout: start on the device below.
    }
  } else if (openHere) {
    return { id: openHere.id, synced: true };
  }

  const record: LocalSession = {
    id,
    ownerId,
    workoutId: input.workoutId,
    gymId: input.gymId,
    startedAt,
    finishedAt: null,
    notes: null,
    createStatus: 'pending',
    finishStatus: 'none',
    attempts: 0,
    lastError: null,
  };
  await db.localSessions.add(record);
  return { id, synced: false };
}

async function recordServerSession(server: ServerSession, ownerId: string, workoutId: string) {
  const db = getDB();
  await db.transaction('rw', db.localSessions, async () => {
    const existing = await db.localSessions.get(server.id);
    if (existing) {
      await db.localSessions.update(server.id, { createStatus: 'synced', lastError: null });
      return;
    }
    await db.localSessions.add({
      id: server.id,
      ownerId,
      workoutId: server.workoutId ?? workoutId,
      gymId: server.gymId,
      startedAt: Date.parse(server.startedAt),
      finishedAt: null,
      notes: null,
      createStatus: 'synced',
      finishStatus: 'none',
      attempts: 0,
      lastError: null,
    });
  });
}

type SessionRef = {
  id: string;
  workoutId: string | null;
  gymId: string | null;
  startedAt: number;
};

// Records a session the server rendered (started online, on another device,
// or before local sessions existed), so a reload without a network can still
// run it from the training pack. An existing record keeps its own state; its
// replaced exercises follow the server's unless a change of its own is still
// waiting to be sent.
export async function rememberSession(
  session: SessionRef & { exerciseSwaps?: Record<string, string> },
): Promise<void> {
  const ownerId = getOutboxOwner();
  if (!ownerId || !session.workoutId) return;
  const db = getDB();
  await db.transaction('rw', db.localSessions, async () => {
    const existing = await db.localSessions.get(session.id);
    if (existing) {
      if (session.exerciseSwaps && existing.swapsStatus !== 'pending') {
        await db.localSessions.update(session.id, {
          exerciseSwaps: session.exerciseSwaps,
          swapsStatus: 'synced',
        });
      }
      return;
    }
    await db.localSessions.add({
      id: session.id,
      ownerId,
      workoutId: session.workoutId!,
      gymId: session.gymId,
      startedAt: session.startedAt,
      finishedAt: null,
      notes: null,
      createStatus: 'synced',
      finishStatus: 'none',
      attempts: 0,
      lastError: null,
      exerciseSwaps: session.exerciseSwaps ?? {},
      swapsStatus: 'synced',
    });
  });
}

// Replaces the exercise of one row for this session only (lib/session-swaps).
// Works offline: the map goes through the outbox, after the session's start
// and before its sets. Returns whether the server already has it.
export async function swapExerciseForSession(
  session: SessionRef,
  programExerciseId: string,
  exerciseId: string,
): Promise<{ synced: boolean }> {
  const ownerId = requireOwner();
  const db = getDB();
  await db.transaction('rw', db.localSessions, async () => {
    const existing = await db.localSessions.get(session.id);
    const exerciseSwaps = { ...(existing?.exerciseSwaps ?? {}), [programExerciseId]: exerciseId };
    if (existing) {
      await db.localSessions.update(session.id, { exerciseSwaps, swapsStatus: 'pending' });
      return;
    }
    await db.localSessions.add({
      id: session.id,
      ownerId,
      workoutId: session.workoutId ?? '',
      gymId: session.gymId,
      startedAt: session.startedAt,
      finishedAt: null,
      notes: null,
      createStatus: 'synced',
      finishStatus: 'none',
      attempts: 0,
      lastError: null,
      exerciseSwaps,
      swapsStatus: 'pending',
    });
  });
  if (online()) await flushPendingSets();
  return { synced: (await db.localSessions.get(session.id))?.swapsStatus === 'synced' };
}

// Finishes a session on this device. The finish reaches the server once all
// of the session's sets did (lib/sync). Returns whether it already got there.
export async function finishSession(
  session: { id: string; workoutId: string | null; gymId: string | null; startedAt: number },
  notes: string | null,
): Promise<{ synced: boolean }> {
  const ownerId = requireOwner();
  const db = getDB();
  const finishedAt = Date.now();
  await db.transaction('rw', db.localSessions, async () => {
    const existing = await db.localSessions.get(session.id);
    if (existing) {
      await db.localSessions.update(session.id, {
        finishedAt: existing.finishedAt ?? finishedAt,
        finishStatus: existing.finishStatus === 'synced' ? 'synced' : 'pending',
        notes: notes ?? existing.notes,
      });
      return;
    }
    // Started before this device kept local sessions, or on another device.
    await db.localSessions.add({
      id: session.id,
      ownerId,
      workoutId: session.workoutId ?? '',
      gymId: session.gymId,
      startedAt: session.startedAt,
      finishedAt,
      notes,
      createStatus: 'synced',
      finishStatus: 'pending',
      attempts: 0,
      lastError: null,
    });
  });
  if (online()) await flushPendingSets();
  // Last-time values changed: the next refresh must not wait for the pack to
  // age out (it runs after the flush that delivers this workout).
  await markTrainingPackStale();
  if (online()) void refreshTrainingPack();
  const stored = await db.localSessions.get(session.id);
  return { synced: stored?.finishStatus === 'synced' };
}
