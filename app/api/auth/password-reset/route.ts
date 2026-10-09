import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createTranslator } from 'next-intl';
import { z } from 'zod';
import { AUTH_JSON_BODY_MAX_BYTES, handleApiError, parseJsonBody } from '@/lib/api';
import { getEmailProvider, resolvePublicAppUrl } from '@/lib/email';
import { issuePasswordReset, RESET_TOKEN_TTL_MS } from '@/lib/password-reset';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { localeCookieName, resolveLocale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';

const requestSchema = z.object({ email: z.string().trim().email().max(200) });

// POST /api/auth/password-reset { email }: e-mails a one-time reset link.
// The answer is the same whether or not the account exists (no e-mail
// enumeration); 503 only says the instance has no e-mail provider.
export async function POST(req: Request) {
  try {
    const rl = rateLimit(`password-reset:${clientIp(req)}`, 5, 15 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
    const { email } = await parseJsonBody(req, requestSchema, {
      maxBytes: AUTH_JSON_BODY_MAX_BYTES,
    });

    const provider = getEmailProvider();
    const appUrl = resolvePublicAppUrl(process.env, new URL(req.url).origin);
    if (!provider || !appUrl) {
      return NextResponse.json(
        { error: 'Password reset by e-mail is not available.' },
        { status: 503 },
      );
    }

    // At most 3 links per address per hour, silently: a flood of reset
    // e-mails must not be usable to harass someone.
    if (rateLimit(`password-reset-email:${email.toLowerCase()}`, 3, 60 * 60_000).ok) {
      const issued = await issuePasswordReset(email, appUrl);
      if (issued) {
        const locale = resolveLocale((await cookies()).get(localeCookieName)?.value);
        const t = createTranslator({
          locale,
          messages: await loadMessages(locale),
          namespace: 'auth.resetEmail',
        });
        // Not awaited: the response time must not reveal that the account exists.
        void provider
          .send({
            to: issued.to,
            subject: t('subject'),
            text: t('body', { link: issued.link, minutes: RESET_TOKEN_TTL_MS / 60_000 }),
          })
          .catch((err: unknown) => {
            console.error(
              '[password-reset] e-mail not sent:',
              err instanceof Error ? err.message : 'unknown error',
            );
          });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
