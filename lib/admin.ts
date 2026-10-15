import { notFound } from 'next/navigation';
import { ApiError, requireApiUserId } from '@/lib/api';
import { requireSession, type SessionClaims } from '@/lib/auth';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';

// Admin access: role ADMIN on the User row. The role is read from the
// database on every request and never carried in the session token, so
// taking it away takes effect on the very next request.

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === 'ADMIN';
}

// For pages: anyone else gets a 404, so the page does not reveal it exists.
export async function requireAdminPage(): Promise<SessionClaims> {
  const session = await requireSession();
  if (!(await isAdmin(session.userId))) notFound();
  return session;
}

// For API routes: 401 without a session, 403 for a signed-in non-admin.
export async function requireAdminUserId(): Promise<string> {
  const userId = await requireApiUserId();
  if (!(await isAdmin(userId))) throw new ApiError(403, 'Forbidden');
  return userId;
}

export const ADMIN_SET_PASSWORD_ACTION = 'ADMIN_SET_PASSWORD';

export type AdminSetPasswordResult =
  | { outcome: 'set'; signedOutSessions: number }
  | { outcome: 'self' }
  | { outcome: 'not_found' };

// An admin sets a new password for another account: the account is signed
// out everywhere (whoever held the old password or a stolen cookie loses
// access), its pending reset links stop working, and AuditLog records who did
// it. The admin's own password goes through Settings, which checks the
// current one.
export async function setPasswordAsAdmin(input: {
  adminId: string;
  targetUserId: string;
  password: string;
  now?: Date;
}): Promise<AdminSetPasswordResult> {
  if (input.targetUserId === input.adminId) return { outcome: 'self' };
  const now = input.now ?? new Date();
  const target = await db.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true },
  });
  if (!target) return { outcome: 'not_found' };

  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash } });
    const revoked = await tx.authSession.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: target.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.adminId,
        entity: 'User',
        entityId: target.id,
        action: ADMIN_SET_PASSWORD_ACTION,
        newValue: { signedOutSessions: revoked.count },
        createdAt: now,
      },
    });
    return { outcome: 'set' as const, signedOutSessions: revoked.count };
  });
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  // Most recent activity across the account's sessions; null if never signed in.
  lastSeenAt: string | null;
}

// The admin list shows only what is needed to pick an account: no profile,
// training or health data.
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const [users, activity] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    }),
    db.authSession.groupBy({ by: ['userId'], _max: { lastSeenAt: true } }),
  ]);
  const lastSeen = new Map(activity.map((row) => [row.userId, row._max.lastSeenAt]));
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    lastSeenAt: lastSeen.get(user.id)?.toISOString() ?? null,
  }));
}
