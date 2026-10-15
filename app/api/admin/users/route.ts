import { NextResponse } from 'next/server';
import { ApiError, AUTH_JSON_BODY_MAX_BYTES, handleApiError, parseJsonBody } from '@/lib/api';
import { createUserAsAdmin, requireAdminUserId } from '@/lib/admin';
import { adminRateLimit } from '@/lib/admin-route';
import { log } from '@/lib/log';
import { adminCreateUserSchema } from '@/lib/schemas/admin';

// POST /api/admin/users { email, password, displayName?, role? }: an admin
// creates an account directly, outside the signup invite list.
export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'create-user', 20);
    if (limited) return limited;

    const input = await parseJsonBody(req, adminCreateUserSchema, {
      maxBytes: AUTH_JSON_BODY_MAX_BYTES,
    });
    const result = await createUserAsAdmin({ adminId, ...input });
    if (result.outcome === 'exists') {
      throw new ApiError(409, 'An account with this email already exists.');
    }

    log.info('admin.user_created', { actorUserId: adminId, targetUserId: result.id });
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
