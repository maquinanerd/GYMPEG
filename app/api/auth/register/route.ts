import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth-token';
import { createAuthSession } from '@/lib/auth-session';
import { hashPassword } from '@/lib/password';
import { registerSchema } from '@/lib/schemas/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { isSignupAllowed } from '@/lib/signup-policy';
import { ApiError, AUTH_JSON_BODY_MAX_BYTES, readJsonBodyOrNull } from '@/lib/api';

// POST /api/auth/register: creates an account, seeds the default exercise
// catalog for it, and signs the user in. Public route (see middleware).
export async function POST(req: Request) {
  try {
    const rl = rateLimit(`register:${clientIp(req)}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const body = await readJsonBodyOrNull(req, AUTH_JSON_BODY_MAX_BYTES);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
        { status: 400 },
      );
    }

    const { email, password, displayName, timezone } = parsed.data;
    // Checked before any lookup: a refused signup must not reveal whether the
    // email already has an account.
    if (!isSignupAllowed(email)) {
      return NextResponse.json(
        { error: 'Signups are by invitation only.', code: 'SIGNUP_RESTRICTED' },
        { status: 403 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName ?? null,
        ...(timezone ? { timezone } : {}),
      },
    });

    // No per-account catalog copy: every account shares the global catalog
    // (data/catalog, synced at server start).

    const { token } = await createAuthSession({
      userId: user.id,
      email: user.email,
      userAgent: req.headers.get('user-agent'),
    });
    (await cookies()).set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[register] error:', err);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
