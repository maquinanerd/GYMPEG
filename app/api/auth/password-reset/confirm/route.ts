import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { AUTH_JSON_BODY_MAX_BYTES, handleApiError, parseJsonBody } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/auth-token';
import { completePasswordReset } from '@/lib/password-reset';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { passwordSchema } from '@/lib/schemas/auth';

const confirmSchema = z.object({
  token: z.string().min(1).max(128),
  password: passwordSchema,
});

// POST /api/auth/password-reset/confirm { token, password }: sets the new
// password from a reset link and signs the account out on every device.
export async function POST(req: Request) {
  try {
    const rl = await rateLimit(`password-reset-confirm:${clientIp(req)}`, 10, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
    const { token, password } = await parseJsonBody(req, confirmSchema, {
      maxBytes: AUTH_JSON_BODY_MAX_BYTES,
    });

    const outcome = await completePasswordReset(token, password);
    if (outcome !== 'reset') {
      return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 400 });
    }
    // Every session was revoked, this device's included.
    (await cookies()).delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
