import { NextResponse } from 'next/server';
import { setInputSchema } from '@/lib/schemas/set';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { createSessionSet } from '@/lib/set-mutations';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/sessions/[id]/sets: records a set in a session (lib/set-mutations).
//
// Idempotent when the offline queue sends `clientMutationId`: a retried POST
// (lost response, reload, two tabs) returns the set already stored with that
// key (200) instead of creating a duplicate, and 410 when that set was deleted
// meanwhile. `performedAt` (device clock, bounded) becomes completedAt.
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, setInputSchema);
    const { set, replayed } = await createSessionSet(userId, params.id, data);
    return NextResponse.json(set, { status: replayed ? 200 : 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
