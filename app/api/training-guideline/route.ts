import { NextResponse } from 'next/server';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { TRAINING_GUIDELINE } from '@/lib/training-engine/guideline';

// GET /api/training-guideline: the parameters of the training engine in force
// (epic 2.6), with their version, source and date. Read-only: the coach and
// the AI layer cite them; they are changed only in code, as a new version.
export async function GET() {
  try {
    await requireApiUserId();
    return NextResponse.json(TRAINING_GUIDELINE);
  } catch (err) {
    return handleApiError(err);
  }
}
