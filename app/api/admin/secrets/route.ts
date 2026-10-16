import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody } from '@/lib/api';
import { requireAdminUserId } from '@/lib/admin';
import { setSecretAsAdmin } from '@/lib/admin-config';
import { adminRateLimit } from '@/lib/admin-route';
import { secretUpdateSchema } from '@/lib/admin-settings';
import { lastFour } from '@/lib/secret-box';

// PUT /api/admin/secrets { key, value | null }: saves an API key (encrypted,
// lib/secret-box) or removes it. The response carries only its last 4
// characters; a saved key is never sent back.
export async function PUT(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'secrets', 20);
    if (limited) return limited;

    const { key, value } = await parseJsonBody(req, secretUpdateSchema, { maxBytes: 4 * 1024 });
    await setSecretAsAdmin(adminId, key, value);
    return NextResponse.json({ ok: true, last4: value === null ? null : lastFour(value) });
  } catch (err) {
    return handleApiError(err);
  }
}
