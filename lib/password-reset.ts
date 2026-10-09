import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';

// Password reset by e-mail link (G1). The link carries a random 256-bit
// token; only its SHA-256 hash is stored. A link expires after 30 minutes,
// works once, and asking again replaces the user's earlier unused links.
// Using it sets the new password and signs the account out everywhere.

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isResetTokenShape(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function buildResetLink(appUrl: string, token: string): string {
  const url = new URL('/reset-password', appUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

// Issues a link for the account with that e-mail, or null when there is no
// such account. The caller answers the same either way.
export async function issuePasswordReset(
  email: string,
  appUrl: string,
  now: Date = new Date(),
): Promise<{ to: string; link: string; expiresAt: Date } | null> {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return null;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);
  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), createdAt: now, expiresAt },
    }),
  ]);
  return { to: user.email, link: buildResetLink(appUrl, token), expiresAt };
}

export type ResetOutcome = 'reset' | 'invalid';

// Sets the new password when the token is known, unused and not expired. The
// claim is conditional on `usedAt` still being null, so two concurrent uses of
// the same link cannot both succeed.
export async function completePasswordReset(
  token: string,
  newPassword: string,
  now: Date = new Date(),
): Promise<ResetOutcome> {
  if (!isResetTokenShape(token)) return 'invalid';
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!row || row.usedAt || row.expiresAt <= now) return 'invalid';

  const passwordHash = await hashPassword(newPassword);
  return db.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return 'invalid' as const;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    // Anyone holding the old password (or a stolen cookie) is signed out.
    await tx.authSession.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    });
    return 'reset' as const;
  });
}
