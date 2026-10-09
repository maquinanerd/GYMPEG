import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { buildAccountExport } from '@/lib/account-export';

// GET /api/account/export: every piece of data of the signed-in account, as
// a ZIP (LGPD data portability, epic 1.7). Streamed; never cached.
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const rl = rateLimit(`account-export:${userId}`, 5, 60 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many exports. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const t = await getTranslations('settings.privacy');
    const { filename, stream } = await buildAccountExport(userId, { readme: t('readme') });
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
