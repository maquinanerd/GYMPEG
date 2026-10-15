import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, AUTH_JSON_BODY_MAX_BYTES, handleApiError, parseJsonBody } from '@/lib/api';
import { requireAdminUserId, setPasswordAsAdmin } from '@/lib/admin';
import { log } from '@/lib/log';
import { rateLimit } from '@/lib/rate-limit';
import { passwordSchema } from '@/lib/schemas/auth';

interface Params {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ password: passwordSchema });

// POST /api/admin/users/[id]/password { password }: an admin sets a new
// password for another account (lib/admin). Admins only; the target is any
// account but the admin's own.
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const adminId = await requireAdminUserId();

    const rl = await rateLimit(`admin-password:${adminId}`, 20, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const { password } = await parseJsonBody(req, bodySchema, {
      maxBytes: AUTH_JSON_BODY_MAX_BYTES,
    });

    const result = await setPasswordAsAdmin({ adminId, targetUserId: params.id, password });
    if (result.outcome === 'self') {
      throw new ApiError(400, 'Change your own password in Settings.');
    }
    if (result.outcome === 'not_found') {
      throw new ApiError(404, 'User not found.');
    }

    log.info('admin.password_set', { actorUserId: adminId, targetUserId: params.id });
    return NextResponse.json({ ok: true, signedOutSessions: result.signedOutSessions });
  } catch (err) {
    return handleApiError(err);
  }
}
