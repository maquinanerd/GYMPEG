import { NextResponse } from 'next/server';
import { ApiError, handleApiError, parseJsonBody, AUTH_JSON_BODY_MAX_BYTES } from '@/lib/api';
import { getCurrentSession } from '@/lib/auth';
import { revokeOtherAuthSessions } from '@/lib/auth-session';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/rate-limit';
import { changePasswordSchema } from '@/lib/schemas/auth';

// POST /api/auth/password: changes the signed-in user's password after
// checking the current one, then signs out every other device (a password
// change is the usual reaction to a suspected leak). This device stays in.
export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new ApiError(401, 'Unauthorized');

    const rl = await rateLimit(`password:${session.userId}`, 5, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const { currentPassword, newPassword } = await parseJsonBody(req, changePasswordSchema, {
      maxBytes: AUTH_JSON_BODY_MAX_BYTES,
    });

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new ApiError(400, 'Current password is incorrect.');
    }

    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    const signedOut = await revokeOtherAuthSessions(session.userId, session.sid);

    return NextResponse.json({ ok: true, signedOutSessions: signedOut });
  } catch (err) {
    return handleApiError(err);
  }
}
