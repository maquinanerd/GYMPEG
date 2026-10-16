import { NextResponse } from 'next/server';
import { ApiError, AUTH_JSON_BODY_MAX_BYTES, handleApiError, parseJsonBody } from '@/lib/api';
import { requireAdminUserId, setPasswordAsAdmin } from '@/lib/admin';
import { adminRateLimit } from '@/lib/admin-route';
import { log } from '@/lib/log';
import { adminSetPasswordSchema } from '@/lib/schemas/admin';

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/admin/users/[id]/password { password }: an admin sets a new
// password for another account (lib/admin). Admins only; the target is any
// account but the admin's own.
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'password', 20);
    if (limited) return limited;

    const { password } = await parseJsonBody(req, adminSetPasswordSchema, {
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
