// Wire format of the batched set push (POST /api/sessions/[id]/sets/batch),
// shared by the route and the device outbox (lib/sync). Client-safe: no
// server imports.

export const MAX_BATCH_ITEMS = 100;

export interface BatchCreateItem {
  op: 'create';
  key: string;
  set: Record<string, unknown>;
}

export interface BatchUpdateItem {
  op: 'update';
  key: string;
  setId: string;
  patch: { weight: number; reps: number; rir: number | null; rpe?: number | null };
}

export interface BatchDeleteItem {
  op: 'delete';
  key: string;
  setId?: string;
  clientMutationId?: string;
}

export type BatchItem = BatchCreateItem | BatchUpdateItem | BatchDeleteItem;

export interface BatchItemResult {
  key: string;
  // HTTP-like status of this item alone (201 created, 200 done, 4xx/5xx).
  status: number;
  set?: { id: string; gymEquipmentId?: string | null };
  error?: string;
}

// Statuses a retry cannot change (bad input, gone, conflict): the item is
// marked failed instead of being resent forever. 410 on a create means the
// set was deleted meanwhile, which the outbox handles on its own.
export function isFatalItemStatus(status: number): boolean {
  return status === 400 || status === 404 || status === 409 || status === 422;
}
