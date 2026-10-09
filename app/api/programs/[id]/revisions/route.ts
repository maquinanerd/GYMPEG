import { NextResponse } from 'next/server';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { listProgramRevisions } from '@/lib/program-revisions';

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/programs/[id]/revisions: the program's versions, newest first.
export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    return NextResponse.json(await listProgramRevisions(userId, params.id));
  } catch (err) {
    return handleApiError(err);
  }
}
