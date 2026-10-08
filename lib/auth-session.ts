import { db } from '@/lib/db';
import { SESSION_TTL_SECONDS, signSession, type SessionClaims } from '@/lib/auth-token';

// Server-side session store (Node runtime only). Each login creates an
// AuthSession row; the session token carries its id (`sid`). Logout,
// "sign out other devices" and password changes revoke rows, which takes
// effect on the next request because every data access re-checks the row.

// lastSeenAt is refreshed at most this often, so reads do not write on every
// request.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const USER_AGENT_MAX = 255;

export async function createAuthSession(input: {
  userId: string;
  email: string;
  userAgent?: string | null;
  now?: Date;
}): Promise<{ token: string; sessionId: string }> {
  const now = input.now ?? new Date();
  const session = await db.authSession.create({
    data: {
      userId: input.userId,
      expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
      userAgent: input.userAgent?.slice(0, USER_AGENT_MAX) ?? null,
      createdAt: now,
      lastSeenAt: now,
    },
    select: { id: true },
  });
  const token = await signSession({ userId: input.userId, email: input.email, sid: session.id });
  return { token, sessionId: session.id };
}

// True when the token's session row exists, belongs to the token's user, is
// not revoked and has not expired.
export async function isSessionActive(
  claims: SessionClaims,
  now: Date = new Date(),
): Promise<boolean> {
  if (!claims.sid) return false;
  const row = await db.authSession.findUnique({
    where: { id: claims.sid },
    select: { userId: true, revokedAt: true, expiresAt: true, lastSeenAt: true },
  });
  if (!row || row.userId !== claims.userId || row.revokedAt || row.expiresAt <= now) {
    return false;
  }
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Best effort: a failed touch must never fail the request.
    void db.authSession
      .update({ where: { id: claims.sid }, data: { lastSeenAt: now } })
      .catch(() => undefined);
  }
  return true;
}

export async function revokeAuthSession(sessionId: string, userId: string): Promise<void> {
  await db.authSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Revokes every active session of the user except `keepSessionId` (the
// device performing the action). Returns how many were revoked.
export async function revokeOtherAuthSessions(
  userId: string,
  keepSessionId: string | undefined,
): Promise<number> {
  const result = await db.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
