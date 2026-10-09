import { NextResponse } from 'next/server';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { MissingExercisesError, restoreProgramRevision } from '@/lib/program-revisions';

interface Params {
  params: Promise<{ id: string; revisionId: string }>;
}

// POST /api/programs/[id]/revisions/[revisionId]/restore: brings the
// version's content back as a new version (nothing is deleted from the
// history). 409 with `missingExercises` when one of its exercises no longer
// exists.
export async function POST(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const restored = await restoreProgramRevision(userId, params.id, params.revisionId);
    return NextResponse.json(
      {
        id: restored.id,
        version: restored.version,
        restoredFromVersion: restored.restoredFromVersion,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof MissingExercisesError) {
      return NextResponse.json(
        { error: err.message, missingExercises: err.names },
        { status: err.status },
      );
    }
    return handleApiError(err);
  }
}
