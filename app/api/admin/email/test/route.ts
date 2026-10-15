import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createTranslator } from 'next-intl';
import { ApiError, handleApiError } from '@/lib/api';
import { requireAdminUserId } from '@/lib/admin';
import { sendTestEmail } from '@/lib/admin-config';
import { adminRateLimit } from '@/lib/admin-route';
import { db } from '@/lib/db';
import { getRuntimeEnv } from '@/lib/runtime-env';
import { localeCookieName, resolveLocale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';

// POST /api/admin/email/test: sends a test message to the admin's own
// address with the saved e-mail settings, in the admin's language.
export async function POST() {
  try {
    const adminId = await requireAdminUserId();
    const limited = await adminRateLimit(adminId, 'email-test', 5);
    if (limited) return limited;

    const admin = await db.user.findUnique({ where: { id: adminId }, select: { email: true } });
    if (!admin) throw new ApiError(404, 'User not found.');
    const locale = resolveLocale((await cookies()).get(localeCookieName)?.value);
    const t = createTranslator({
      locale,
      messages: await loadMessages(locale),
      namespace: 'admin.email',
    });
    const result = await sendTestEmail(
      { to: admin.email, subject: t('testSubject'), text: t('testBody') },
      await getRuntimeEnv(),
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
