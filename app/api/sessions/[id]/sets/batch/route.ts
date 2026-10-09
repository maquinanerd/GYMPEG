import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { db } from '@/lib/db';
import { setInputSchema, setUpdateSchema } from '@/lib/schemas/set';
import { MAX_BATCH_ITEMS, type BatchItemResult } from '@/lib/set-batch';
import {
  createSessionSet,
  deleteOwnedSet,
  deleteSessionSetByMutationId,
  updateOwnedSet,
} from '@/lib/set-mutations';

interface Params {
  params: Promise<{ id: string }>;
}

const key = z.string().min(1).max(64);
const id = z.string().min(1).max(64);

const itemSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create'), key, set: setInputSchema }),
  z.object({ op: z.literal('update'), key, setId: id, patch: setUpdateSchema }),
  z.object({
    op: z.literal('delete'),
    key,
    setId: id.optional(),
    clientMutationId: id.optional(),
  }),
]);

const batchSchema = z.object({ items: z.array(itemSchema).min(1).max(MAX_BATCH_ITEMS) });

// POST /api/sessions/[id]/sets/batch: the device's pending set changes for one
// session in a single request (ADR-004). Items run in order and each gets its
// own result, so one refused item never sinks the others:
// - create: idempotent on set.clientMutationId (200 replay, 410 deleted);
// - update: correction of a stored set of this session;
// - delete: by setId, or by clientMutationId when the device never learned
//   the server id; deleting something already gone succeeds (tombstone kept).
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const { items } = await parseJsonBody(req, batchSchema, { maxBytes: 256_000 });

    const session = await db.session.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    });
    if (!session) throw new ApiError(404, 'Session not found.');

    const results: BatchItemResult[] = [];
    for (const item of items) {
      try {
        if (item.op === 'create') {
          const { set, replayed } = await createSessionSet(userId, params.id, item.set);
          results.push({ key: item.key, status: replayed ? 200 : 201, set });
        } else if (item.op === 'update') {
          const set = await updateOwnedSet(userId, item.setId, item.patch, {
            sessionId: params.id,
          });
          results.push({ key: item.key, status: 200, set });
        } else {
          await deleteItem(userId, params.id, item);
          results.push({ key: item.key, status: 200 });
        }
      } catch (err) {
        if (err instanceof ApiError) {
          results.push({ key: item.key, status: err.status, error: err.message });
        } else {
          console.error('[sets/batch] item failed:', err);
          results.push({ key: item.key, status: 500, error: 'Server error.' });
        }
      }
    }
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}

async function deleteItem(
  userId: string,
  sessionId: string,
  item: { setId?: string; clientMutationId?: string },
): Promise<void> {
  if (item.setId) {
    try {
      await deleteOwnedSet(userId, item.setId, { sessionId });
    } catch (err) {
      // Already deleted (another device, an earlier attempt): the goal is met,
      // as long as the device key is tombstoned too.
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
    if (item.clientMutationId) {
      await deleteSessionSetByMutationId(userId, sessionId, item.clientMutationId);
    }
    return;
  }
  if (item.clientMutationId) {
    await deleteSessionSetByMutationId(userId, sessionId, item.clientMutationId);
    return;
  }
  throw new ApiError(400, 'A delete needs setId or clientMutationId.');
}
