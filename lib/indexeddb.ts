// ============================================================
// Dexie: IndexedDB for the offline outbox (ADR-004)
// ============================================================
// - pendingSets: the sets logged on this device, synced or waiting.
// - localSessions: sessions started or finished on this device, so both
//   work without a network; the outbox sends the start, then the sets, then
//   the finish.
// - trainingPacks: the data needed to run the active program's workouts
//   offline (lib/training-pack).
// Every item records the account that queued it (ownerId): the outbox is
// scoped per user.
//
// IMPORTANT: this module must NEVER be imported server-side.
// The Dexie instance is only created client-side. Components
// must check `typeof window !== 'undefined'` or use
// dexie-react-hooks (which already does it).

import Dexie, { type Table } from 'dexie';
import type { SetType } from '@/lib/prisma-client';
import type { SessionPack } from '@/app/api/session-pack/route';

export type PendingSetStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface PendingSet {
  // Local identifier (client cuid) used as the primary key and for the
  // optimistic display before server confirmation.
  localId: string;

  // Reference to the current session. When the sync succeeds, the server set
  // is created under this sessionId.
  sessionId: string;

  exerciseId: string;
  // Concrete physical machine/equipment selected for this set. Optional keeps
  // IndexedDB rows written before equipment selection backward-compatible.
  gymEquipmentId?: string | null;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  // Cardio sets (issue #133): duration in seconds and optional distance in
  // meters. Null on strength sets. Optional so records written before the
  // field existed (which lack the keys entirely) stay valid.
  durationSec?: number | null;
  distanceM?: number | null;
  notes: string | null;
  isWarmup: boolean;
  isDropSet: boolean;
  // Kind of set and optional RPE (6-10). Optional so rows written before
  // these fields existed stay valid; the server derives the type from the
  // flags when it is missing.
  type?: SetType;
  rpe?: number | null;

  createdAt: number; // epoch ms
  status: PendingSetStatus;
  // If synced: server id returned by the API. Allows reconciliation
  // with the UI state and avoids double-POST on retry.
  serverId: string | null;
  syncedAt: number | null;
  // Counter of failed attempts (for possible backoff).
  attempts: number;
  lastError: string | null;
  // Set when the server dropped this set's equipment reference and the user has
  // not been told yet (issue #337). Holds the id that was dropped, since
  // `gymEquipmentId` is nulled at the same moment.
  //
  // Persisted rather than only broadcast: a flush can complete with no
  // SessionRunner mounted (`sync-bootstrap` binds auto-sync app-wide, so one
  // fires at startup on any page) and a notice delivered to no listener was
  // gone for good. Cleared by `drainDroppedEquipment` once it has been shown.
  // Optional, so rows written before this field stay valid.
  equipmentDroppedNotice?: string | null;
  // Account that queued the set. Absent on rows written before the outbox
  // was scoped per user.
  ownerId?: string | null;
  // Deleted on this device (epoch ms) and waiting for the server to confirm
  // (lib/sync queueSetDeletion): hidden from every view, removed once the
  // server answers. Optional, so earlier rows stay valid.
  deletedAt?: number | null;
}

export type OutboxStatus = 'pending' | 'synced' | 'failed';

export interface LocalSession {
  // Device-generated UUIDv7, also the server id once the start syncs.
  id: string;
  ownerId: string;
  workoutId: string;
  gymId: string | null;
  startedAt: number; // epoch ms, device clock
  finishedAt: number | null; // set when finished on this device
  notes: string | null;
  // Server state of the start. A session that already exists on the server
  // (started online, or before this table existed) is 'synced'.
  createStatus: OutboxStatus;
  // Server state of the finish; 'none' while the session is open here.
  finishStatus: 'none' | OutboxStatus;
  attempts: number;
  lastError: string | null;
  // Exercises replaced only for this session (lib/session-swaps), and the
  // server state of that map. Optional: records written before swaps existed.
  exerciseSwaps?: Record<string, string>;
  swapsStatus?: 'none' | OutboxStatus;
}

// What the device needs to start and run a workout offline (the response of
// GET /api/session-pack), one record per account. Health data: dropped on
// logout even when the outbox is kept.
export interface StoredTrainingPack {
  ownerId: string;
  savedAt: number; // epoch ms
  pack: SessionPack;
}

class GymCoachDB extends Dexie {
  pendingSets!: Table<PendingSet, string>;
  localSessions!: Table<LocalSession, string>;
  trainingPacks!: Table<StoredTrainingPack, string>;

  constructor() {
    super('GymCoachDB');
    this.version(1).stores({
      // Primary key: localId. Secondary indexes: sessionId (to filter
      // a session's sets), status (to scan the pending ones).
      pendingSets: 'localId, sessionId, status, createdAt',
    });
    this.version(2).stores({
      pendingSets: 'localId, sessionId, status, createdAt, ownerId',
      localSessions: 'id, ownerId, workoutId',
    });
    this.version(3).stores({
      trainingPacks: 'ownerId',
    });
  }
}

let _db: GymCoachDB | null = null;

export function getDB(): GymCoachDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available client-side.');
  }
  if (!_db) _db = new GymCoachDB();
  return _db;
}

// Deletes the whole local database (logout on a device with nothing left to
// sync). The next getDB() call opens a fresh, empty one.
export async function deleteLocalDB(): Promise<void> {
  if (!_db && typeof window === 'undefined') return;
  const db = getDB();
  _db = null;
  await db.delete();
}

// Generates a simple cuid client-side (good enough for localIds).
// We use crypto.randomUUID if available, otherwise fall back to Math.random.
export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `loc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `loc_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
