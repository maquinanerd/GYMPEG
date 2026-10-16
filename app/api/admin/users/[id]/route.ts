import { NextResponse } from 'next/server';
import { ApiError, handleApiError, parseJsonBody } from '@/lib/api';
import { deleteUserAsAdmin, requireAdminUserId, updateUserAsAdmin } from '@/lib/admin';
import { adminRateLimit } from '@/lib/admin-route';
import { log } from '@/lib/log';
import { adminDeleteUserSchema, adminUpdateUserSchema } from '@/lib/schemas/admin';

interface Params {
  params: Promise<{ id: string }>;
}

const SELF_ERROR = 'You cannot change your own account here.';

// PATCH /api/admin/users/[id] { blocked?, role? }: blocks or unblocks another
// account, or changes its role. Blocking signs it out everywhere.
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'update-user');
    if (limited) return limited;

    const input = await parseJsonBody(req, adminUpdateUserSchema, { maxBytes: 1024 });
    const result = await updateUserAsAdmin({ adminId, targetUserId: params.id, ...input });
    if (result.outcome === 'self') throw new ApiError(400, SELF_ERROR);
    if (result.outcome === 'not_found') throw new ApiError(404, 'User not found.');

    log.info('admin.user_updated', { actorUserId: adminId, targetUserId: params.id, ...input });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/admin/users/[id] { confirmEmail }: erases another account and
// all its data (LGPD). The account's e-mail must be retyped to confirm.
export async function DELETE(req: Request, props: Params) {
  const params = await props.params;
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'delete-user', 10);
    if (limited) return limited;

    const { confirmEmail } = await parseJsonBody(req, adminDeleteUserSchema, { maxBytes: 1024 });
    const result = await deleteUserAsAdmin({ adminId, targetUserId: params.id, confirmEmail });
    if (result.outcome === 'self') throw new ApiError(400, SELF_ERROR);
    if (result.outcome === 'not_found') throw new ApiError(404, 'User not found.');
    if (result.outcome === 'mismatch') {
      throw new ApiError(400, 'The e-mail does not match this account.');
    }

    log.info('admin.user_deleted', { actorUserId: adminId, targetUserId: params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
