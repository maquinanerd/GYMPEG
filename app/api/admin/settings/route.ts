import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody } from '@/lib/api';
import { requireAdminUserId } from '@/lib/admin';
import { updateSettingsAsAdmin } from '@/lib/admin-config';
import { adminRateLimit } from '@/lib/admin-route';
import { settingsUpdateSchema } from '@/lib/admin-settings';

// PUT /api/admin/settings { settings: { KEY: value | null } }: saves instance
// settings (AI provider and models, AI features and prices, e-mail sender).
// null clears a value so the environment variable applies again.
export async function PUT(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'settings', 60);
    if (limited) return limited;

    const changes = await parseJsonBody(req, settingsUpdateSchema, { maxBytes: 8 * 1024 });
    const changed = await updateSettingsAsAdmin(adminId, changes);
    return NextResponse.json({ ok: true, changed });
  } catch (err) {
    return handleApiError(err);
  }
}
