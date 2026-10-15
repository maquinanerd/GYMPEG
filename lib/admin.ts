import { notFound } from 'next/navigation';
import type { Prisma } from '@/prisma/generated/client';
import { ApiError, requireApiUserId } from '@/lib/api';
import { requireSession, type SessionClaims } from '@/lib/auth';
import { deleteAccount } from '@/lib/account-deletion';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';

// Admin access: role ADMIN on the User row. The role is read from the
// database on every request and never carried in the session token, so
// taking it away takes effect on the very next request.

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, blockedAt: true },
  });
  return user?.role === 'ADMIN' && !user.blockedAt;
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

// Every admin action leaves one AuditLog row (spec §43). Values never hold a
// password, a key or personal data beyond ids.
export const AUDIT_ACTIONS = [
  'ADMIN_SET_PASSWORD',
  'ADMIN_CREATE_USER',
  'ADMIN_BLOCK_USER',
  'ADMIN_UNBLOCK_USER',
  'ADMIN_SET_ROLE',
  'ADMIN_DELETE_USER',
  'SETTING_UPDATE',
  'SECRET_SET',
  'SECRET_CLEAR',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ADMIN_SET_PASSWORD_ACTION: AuditAction = 'ADMIN_SET_PASSWORD';

type Tx = Prisma.TransactionClient;

export async function recordAudit(
  client: Tx | typeof db,
  entry: {
    actorUserId: string;
    entity: 'User' | 'AppSetting' | 'AppSecret';
    entityId: string;
    action: AuditAction;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    createdAt?: Date;
  },
): Promise<void> {
  await client.auditLog.create({ data: entry });
}

// Ends every way into an account: login sessions and MCP tokens.
async function signOutEverywhere(tx: Tx, userId: string, now: Date): Promise<number> {
  const sessions = await tx.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
  await tx.mcpAccessToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  return sessions.count;
}

type Outcome<T extends object = object> =
  | ({ outcome: 'done' } & T)
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
}): Promise<Outcome<{ signedOutSessions: number }>> {
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
    await recordAudit(tx, {
      actorUserId: input.adminId,
      entity: 'User',
      entityId: target.id,
      action: 'ADMIN_SET_PASSWORD',
      newValue: { signedOutSessions: revoked.count },
      createdAt: now,
    });
    return { outcome: 'done' as const, signedOutSessions: revoked.count };
  });
}

// Creates an account without going through /signup (and its invite list):
// the admin hands the password over. Same defaults as a self-made account.
export async function createUserAsAdmin(input: {
  adminId: string;
  email: string;
  password: string;
  displayName?: string | null;
  role: 'USER' | 'ADMIN';
}): Promise<{ outcome: 'done'; id: string } | { outcome: 'exists' }> {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) return { outcome: 'exists' };
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
        role: input.role,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      actorUserId: input.adminId,
      entity: 'User',
      entityId: user.id,
      action: 'ADMIN_CREATE_USER',
      newValue: { role: input.role },
    });
    return { outcome: 'done' as const, id: user.id };
  });
}

// Blocks or unblocks an account, or changes its role. Never the admin's own
// account: an admin cannot lock themselves out or leave the instance without
// an admin.
export async function updateUserAsAdmin(input: {
  adminId: string;
  targetUserId: string;
  blocked?: boolean;
  role?: 'USER' | 'ADMIN';
  now?: Date;
}): Promise<Outcome> {
  if (input.targetUserId === input.adminId) return { outcome: 'self' };
  const now = input.now ?? new Date();
  const target = await db.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, role: true, blockedAt: true },
  });
  if (!target) return { outcome: 'not_found' };

  await db.$transaction(async (tx) => {
    if (input.blocked === true && !target.blockedAt) {
      await tx.user.update({ where: { id: target.id }, data: { blockedAt: now } });
      const signedOutSessions = await signOutEverywhere(tx, target.id, now);
      await recordAudit(tx, {
        actorUserId: input.adminId,
        entity: 'User',
        entityId: target.id,
        action: 'ADMIN_BLOCK_USER',
        newValue: { signedOutSessions },
        createdAt: now,
      });
    } else if (input.blocked === false && target.blockedAt) {
      await tx.user.update({ where: { id: target.id }, data: { blockedAt: null } });
      await recordAudit(tx, {
        actorUserId: input.adminId,
        entity: 'User',
        entityId: target.id,
        action: 'ADMIN_UNBLOCK_USER',
        createdAt: now,
      });
    }
    if (input.role && input.role !== target.role) {
      await tx.user.update({ where: { id: target.id }, data: { role: input.role } });
      await recordAudit(tx, {
        actorUserId: input.adminId,
        entity: 'User',
        entityId: target.id,
        action: 'ADMIN_SET_ROLE',
        oldValue: { role: target.role },
        newValue: { role: input.role },
        createdAt: now,
      });
    }
  });
  return { outcome: 'done' };
}

// Erases another account and all its data (lib/account-deletion, LGPD). The
// admin retypes the account's e-mail to confirm. The audit row keeps only the
// id, which points at nothing once the account is gone.
export async function deleteUserAsAdmin(input: {
  adminId: string;
  targetUserId: string;
  confirmEmail: string;
}): Promise<Outcome | { outcome: 'mismatch' }> {
  if (input.targetUserId === input.adminId) return { outcome: 'self' };
  const target = await db.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, email: true },
  });
  if (!target) return { outcome: 'not_found' };
  if (target.email !== input.confirmEmail.trim()) return { outcome: 'mismatch' };

  await deleteAccount(target.id);
  await recordAudit(db, {
    actorUserId: input.adminId,
    entity: 'User',
    entityId: target.id,
    action: 'ADMIN_DELETE_USER',
  });
  return { outcome: 'done' };
}

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  blocked: boolean;
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
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        blockedAt: true,
        createdAt: true,
      },
    }),
    db.authSession.groupBy({ by: ['userId'], _max: { lastSeenAt: true } }),
  ]);
  const lastSeen = new Map(activity.map((row) => [row.userId, row._max.lastSeenAt]));
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    blocked: user.blockedAt !== null,
    createdAt: user.createdAt.toISOString(),
    lastSeenAt: lastSeen.get(user.id)?.toISOString() ?? null,
  }));
}
