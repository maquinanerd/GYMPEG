import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { resetRateLimits } from '@/lib/rate-limit';
import type { EmailMessage, EmailProvider } from '@/lib/email';

// Password reset by e-mail link (G1): one-time hashed tokens, no account
// enumeration, every session revoked on use.

const mail = vi.hoisted(() => ({
  outbox: [] as EmailMessage[],
  configured: true,
}));
vi.mock('@/lib/email', () => ({
  getEmailProvider: (): EmailProvider | null =>
    mail.configured
      ? {
          name: 'memory',
          send: async (message: EmailMessage) => {
            mail.outbox.push(message);
          },
        }
      : null,
  resolvePublicAppUrl: () => 'https://gympeg.test',
}));
const cookieDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ delete: cookieDelete, get: () => undefined }),
}));

import { POST as requestReset } from '@/app/api/auth/password-reset/route';
import { POST as confirmReset } from '@/app/api/auth/password-reset/confirm/route';
import { issuePasswordReset, RESET_TOKEN_TTL_MS } from '@/lib/password-reset';

const EMAIL = 'reset@test.dev';

function post(handler: (req: Request) => Promise<Response>, path: string, body: unknown) {
  return handler(
    new Request(`http://test.local${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
      body: JSON.stringify(body),
    }),
  );
}

function tokenFrom(message: EmailMessage | undefined): string {
  const link = message?.text.match(/https:\/\/gympeg\.test\/reset-password\?token=([\w-]+)/);
  if (!link?.[1]) throw new Error('no reset link in the e-mail');
  return link[1];
}

async function seedUser() {
  const user = await db.user.create({
    data: { email: EMAIL, passwordHash: await hashPassword('old-password') },
  });
  await db.authSession.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  return user;
}

beforeEach(() => {
  mail.outbox.length = 0;
  mail.configured = true;
  cookieDelete.mockReset();
  resetRateLimits();
});

describe('password reset by e-mail', () => {
  it('e-mails a one-time link that sets the password and signs out everywhere', async () => {
    const user = await seedUser();

    const res = await post(requestReset, '/api/auth/password-reset', { email: EMAIL });
    expect(res.status).toBe(200);
    expect(mail.outbox).toHaveLength(1);
    expect(mail.outbox[0]!.to).toBe(EMAIL);
    const token = tokenFrom(mail.outbox[0]);

    // Only the hash is stored.
    const stored = await db.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toContain(token);

    const done = await post(confirmReset, '/api/auth/password-reset/confirm', {
      token,
      password: 'brand-new-password',
    });
    expect(done.status).toBe(200);
    expect(cookieDelete).toHaveBeenCalled();
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword('brand-new-password', updated.passwordHash)).toBe(true);
    expect(await db.authSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);

    const again = await post(confirmReset, '/api/auth/password-reset/confirm', {
      token,
      password: 'another-password',
    });
    expect(again.status).toBe(400);
  });

  it('answers the same for an unknown e-mail without sending anything', async () => {
    await seedUser();
    const res = await post(requestReset, '/api/auth/password-reset', {
      email: 'nobody@test.dev',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mail.outbox).toHaveLength(0);
  });

  it('replaces earlier links and refuses expired ones', async () => {
    await seedUser();
    await post(requestReset, '/api/auth/password-reset', { email: EMAIL });
    await post(requestReset, '/api/auth/password-reset', { email: EMAIL });
    const [first, second] = mail.outbox.map(tokenFrom);

    const stale = await post(confirmReset, '/api/auth/password-reset/confirm', {
      token: first,
      password: 'brand-new-password',
    });
    expect(stale.status).toBe(400);

    const past = new Date(Date.now() - RESET_TOKEN_TTL_MS - 1000);
    const expired = await issuePasswordReset(EMAIL, 'https://gympeg.test', past);
    const expiredToken = new URL(expired!.link).searchParams.get('token');
    const late = await post(confirmReset, '/api/auth/password-reset/confirm', {
      token: expiredToken,
      password: 'brand-new-password',
    });
    expect(late.status).toBe(400);

    // Issuing the expired link also replaced the second one.
    const replaced = await post(confirmReset, '/api/auth/password-reset/confirm', {
      token: second,
      password: 'brand-new-password',
    });
    expect(replaced.status).toBe(400);
  });

  it('caps the links per address and rejects malformed input', async () => {
    await seedUser();
    for (let i = 0; i < 4; i += 1) {
      const res = await post(requestReset, '/api/auth/password-reset', { email: EMAIL });
      expect(res.status).toBe(200);
    }
    expect(mail.outbox).toHaveLength(3);

    const bad = await post(requestReset, '/api/auth/password-reset', { email: 'not-an-email' });
    expect(bad.status).toBe(400);
    const weak = await post(confirmReset, '/api/auth/password-reset/confirm', {
      token: tokenFrom(mail.outbox[2]),
      password: 'short',
    });
    expect(weak.status).toBe(400);
  });

  it('says the feature is unavailable without an e-mail provider', async () => {
    await seedUser();
    mail.configured = false;
    const res = await post(requestReset, '/api/auth/password-reset', { email: EMAIL });
    expect(res.status).toBe(503);
    expect(await db.passwordResetToken.count()).toBe(0);
  });
});
