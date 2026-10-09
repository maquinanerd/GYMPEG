// The training pack: what the device keeps to start and run the active
// program's workouts without a network (ADR-004). Refreshed from
// GET /api/session-pack while online, stored per account in IndexedDB.
//
// The pack travels as JSON, so its Prisma date fields hold ISO strings at
// runtime. The runner and its children only read dates through `new Date()`,
// which accepts both, and the session dates below are rebuilt as real Dates.
//
// Client-only, like lib/indexeddb.

import { getDB, type LocalSession, type StoredTrainingPack } from '@/lib/indexeddb';
import { getOutboxOwner } from '@/lib/outbox-owner';
import { READINESS_RECENCY_HOURS } from '@/lib/progression';
import { applyExerciseSwaps } from '@/lib/session-swaps';
import type { SessionPack } from '@/app/api/session-pack/route';
import type { SessionRunnerProps } from '@/components/session/session-runner';

// Refresh cadence while online: frequent enough that last-time values and
// suggestions follow the latest workout, rare enough to stay cheap.
export const PACK_MAX_AGE_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

let inFlight: Promise<void> | null = null;

// Downloads a fresh pack when the stored one is older than PACK_MAX_AGE_MS
// (or always with `force`). Silent on failure: the stored pack stays usable.
export function refreshTrainingPack(options: { force?: boolean } = {}): Promise<void> {
  if (!inFlight) {
    inFlight = doRefresh(options.force ?? false).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doRefresh(force: boolean): Promise<void> {
  const ownerId = getOutboxOwner();
  if (!ownerId || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  try {
    const db = getDB();
    if (!force) {
      const stored = await db.trainingPacks.get(ownerId);
      if (stored && Date.now() - stored.savedAt < PACK_MAX_AGE_MS) return;
    }
    const res = await fetch('/api/session-pack', {
      cache: 'no-store',
      signal:
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          : undefined,
    });
    if (!res.ok) return;
    const pack = (await res.json()) as SessionPack;
    // Another account may have signed in while the request was in flight.
    if (getOutboxOwner() !== ownerId) return;
    await db.trainingPacks.put({ ownerId, savedAt: Date.now(), pack });
  } catch {
    // Offline, slow network or storage unavailable: keep the stored pack.
  }
}

// After a finished workout the last-time values changed: refresh on the
// next opportunity instead of waiting for the pack to age out.
export async function markTrainingPackStale(): Promise<void> {
  const ownerId = getOutboxOwner();
  if (!ownerId) return;
  await getDB().trainingPacks.update(ownerId, { savedAt: 0 });
}

// Health data: dropped on logout, even when the outbox has to stay.
export async function deleteTrainingPacks(): Promise<void> {
  await getDB().trainingPacks.clear();
}

export type PackRunnerProps = Omit<SessionRunnerProps, 'initialProgramExerciseId'>;

// The runner props for a session recorded on this device, built from the
// stored pack. Null when the pack does not hold the session's workout (it was
// created after the last refresh, or belongs to another program).
export function runnerPropsFromPack(
  stored: StoredTrainingPack,
  session: LocalSession,
  now: number,
): PackRunnerProps | null {
  const { pack } = stored;
  const entry = pack.workouts.find((item) => item.workout.id === session.workoutId);
  if (!entry) return null;
  // No gym chosen at start: the server uses the active gym, and so does this.
  const gym = pack.gyms.find((item) => item.id === (session.gymId ?? pack.activeGymId)) ?? null;

  // The readiness check-in keeps ageing after the pack was saved.
  const packAgeHours = (now - Date.parse(pack.generatedAt)) / (60 * 60 * 1000);
  const readiness =
    pack.readiness && pack.readiness.ageHours + packAgeHours <= READINESS_RECENCY_HOURS
      ? { ...pack.readiness, ageHours: pack.readiness.ageHours + packAgeHours }
      : null;

  // Exercises replaced only for this session, from the catalog the pack
  // carries (the fields the runner reads).
  const catalog = new Map(
    pack.catalog.map((exercise) => [
      exercise.id,
      exercise as unknown as (typeof entry.workout.exercises)[number]['exercise'],
    ]),
  );
  const workout = {
    ...entry.workout,
    exercises: applyExerciseSwaps(entry.workout.exercises, session.exerciseSwaps ?? {}, catalog),
  };

  return {
    session: {
      id: session.id,
      userId: session.ownerId,
      programId: entry.workout.programId,
      workoutId: entry.workout.id,
      // Assigned by the server when the start reaches it.
      programRevisionId: null,
      gymId: gym?.id ?? null,
      startedAt: new Date(session.startedAt),
      finishedAt: session.finishedAt != null ? new Date(session.finishedAt) : null,
      notes: session.notes,
      exerciseSwaps: session.exerciseSwaps ?? null,
      workout,
      // The sets of a local session live in IndexedDB; the runner reads them there.
      sets: [],
      gym,
    },
    lastPerformances: entry.lastPerformances,
    returnRecommendations: entry.returnRecommendations,
    readiness,
    deloadActive: pack.deloadActive,
    unit: pack.unit,
    catalog: pack.catalog,
  };
}
