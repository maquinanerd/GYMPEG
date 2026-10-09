import { NextResponse } from 'next/server';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { getProgramRevision } from '@/lib/program-revisions';

interface Params {
  params: Promise<{ id: string; revisionId: string }>;
}

// GET /api/programs/[id]/revisions/[revisionId]: one version, what it changed
// from the previous one and what restoring it would change now.
export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    return NextResponse.json(await getProgramRevision(userId, params.id, params.revisionId));
  } catch (err) {
    return handleApiError(err);
  }
}
