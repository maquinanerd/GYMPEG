import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { DELOAD_DURATION_DAYS } from '@/lib/deload';
import { deloadStartSchema } from '@/lib/schemas/deload';

// One-tap planned deload week (issue #112). Both handlers operate strictly on
// the authenticated user's own row (requireApiUserId), so ownership is
// enforced by construction - there is no way to address another user. Each
// deload taken is also kept as a DeloadPeriod (epic 2.5), so "weeks since the
// last deload" survives the end of the week.

// POST /api/deload: starts a deload week ending DELOAD_DURATION_DAYS from now.
// Re-posting while one is active simply restarts the 7-day window.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const { trigger, reasons } = await parseJsonBody(req, deloadStartSchema);
    const now = new Date();
    const deloadUntil = new Date(now.getTime() + DELOAD_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { deloadUntil } }),
      // A restart replaces the running period instead of stacking a second one.
      db.deloadPeriod.updateMany({
        where: { userId, endedAt: null, endsAt: { gt: now } },
        data: { endedAt: now },
      }),
      db.deloadPeriod.create({
        data: {
          userId,
          trigger: trigger ?? (reasons?.length ? 'RECOMMENDED' : 'MANUAL'),
          reasons: [...new Set(reasons ?? [])],
          startedAt: now,
          endsAt: deloadUntil,
        },
      }),
    ]);
    return NextResponse.json({ deloadUntil: deloadUntil.toISOString() }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/deload: ends the deload now (clears deloadUntil and closes the
// running period). Idempotent - deleting with no active deload is a no-op.
export async function DELETE() {
  try {
    const userId = await requireApiUserId();
    const now = new Date();
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { deloadUntil: null } }),
      db.deloadPeriod.updateMany({
        where: { userId, endedAt: null, endsAt: { gt: now } },
        data: { endedAt: now },
      }),
    ]);
    return NextResponse.json({ deloadUntil: null });
  } catch (err) {
    return handleApiError(err);
  }
}
