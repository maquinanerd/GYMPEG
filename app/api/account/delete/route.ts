import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ApiError, handleApiError, parseJsonBody, AUTH_JSON_BODY_MAX_BYTES } from '@/lib/api';
import { getCurrentSession, SESSION_COOKIE } from '@/lib/auth';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/rate-limit';
import { deleteAccountSchema } from '@/lib/schemas/account';
import { deleteAccount } from '@/lib/account-deletion';

// POST /api/account/delete: erases the signed-in account and everything in
// it (LGPD, epic 1.7). Needs the current password and the account's e-mail
// typed in full. Irreversible: the client offers the export first.
export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) throw new ApiError(401, 'Unauthorized');

    const rl = await rateLimit(`account-delete:${session.userId}`, 5, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const { password, confirmEmail } = await parseJsonBody(req, deleteAccountSchema, {
      maxBytes: AUTH_JSON_BODY_MAX_BYTES,
    });
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true, passwordHash: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new ApiError(400, 'Current password is incorrect.');
    }
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new ApiError(400, 'The e-mail does not match this account.');
    }

    await deleteAccount(session.userId);
    (await cookies()).delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
