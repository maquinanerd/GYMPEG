import { NextResponse } from 'next/server';
import { ApiError, handleApiError } from '@/lib/api';
import { getCurrentSession } from '@/lib/auth';
import { revokeOtherAuthSessions } from '@/lib/auth-session';
import { db } from '@/lib/db';

// GET /api/auth/sessions: the signed-in user's active sessions (devices).
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) throw new ApiError(401, 'Unauthorized');
    const rows = await db.authSession.findMany({
      where: { userId: session.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, lastSeenAt: true, userAgent: true },
      orderBy: { lastSeenAt: 'desc' },
    });
    return NextResponse.json({
      sessions: rows.map((row) => ({ ...row, current: row.id === session.sid })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/auth/sessions: signs out every other device. This one stays in.
export async function DELETE() {
  try {
    const session = await getCurrentSession();
    if (!session) throw new ApiError(401, 'Unauthorized');
    const signedOut = await revokeOtherAuthSessions(session.userId, session.sid);
    return NextResponse.json({ ok: true, signedOutSessions: signedOut });
  } catch (err) {
    return handleApiError(err);
  }
}
