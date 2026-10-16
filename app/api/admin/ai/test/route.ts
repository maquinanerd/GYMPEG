import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody } from '@/lib/api';
import { requireAdminUserId } from '@/lib/admin';
import { testAiProvider } from '@/lib/admin-config';
import { adminRateLimit } from '@/lib/admin-route';
import { getRuntimeEnv } from '@/lib/runtime-env';
import { adminAiTestSchema } from '@/lib/schemas/admin';

// POST /api/admin/ai/test { provider }: one tiny request to that provider with
// the saved key and model, so an admin can check them before relying on them.
export async function POST(req: Request) {
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'ai-test', 10);
    if (limited) return limited;

    const { provider } = await parseJsonBody(req, adminAiTestSchema, { maxBytes: 1024 });
    return NextResponse.json(await testAiProvider(provider, await getRuntimeEnv()));
  } catch (err) {
    return handleApiError(err);
  }
}
