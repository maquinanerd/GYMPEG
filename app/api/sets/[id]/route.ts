import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { setUpdateSchema } from '@/lib/schemas/set';
import { deleteOwnedSet, updateOwnedSet } from '@/lib/set-mutations';

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/sets/[id]: correct logged strength values in place.
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, setUpdateSchema);
    return NextResponse.json(await updateOwnedSet(userId, params.id, data));
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/sets/[id]: deletes a set (e.g. an input mistake). A set logged
// by a device leaves a tombstone so a late replay of its creation is refused.
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await deleteOwnedSet(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
