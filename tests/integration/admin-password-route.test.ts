import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { resetRateLimits } from '@/lib/rate-limit';
import { ADMIN_SET_PASSWORD_ACTION, listUsersForAdmin } from '@/lib/admin';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
// Mock it so we can act as the admin, a regular user or nobody.
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn(), requireSession: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as setPassword } from '@/app/api/admin/users/[id]/password/route';

const NEW_PASSWORD = 'nova-senha-123';

function actAs(userId: string | null) {
  mockUserId.mockResolvedValue(userId);
}

function call(targetId: string, body: unknown) {
  return setPassword(
    new Request('http://test.local/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: targetId }) },
  );
}

const future = () => new Date(Date.now() + 60 * 60_000);

async function seed() {
  const [admin, member, other] = await Promise.all([
    db.user.create({ data: { email: 'admin@test.dev', passwordHash: 'old-admin', role: 'ADMIN' } }),
    db.user.create({ data: { email: 'member@test.dev', passwordHash: 'old-member' } }),
    db.user.create({ data: { email: 'other@test.dev', passwordHash: 'old-other' } }),
  ]);
  await db.authSession.createMany({
    data: [
      { userId: member.id, expiresAt: future() },
      { userId: member.id, expiresAt: future() },
      { userId: admin.id, expiresAt: future() },
    ],
  });
  await db.passwordResetToken.create({
    data: { userId: member.id, tokenHash: 'pending-link', expiresAt: future() },
  });
  return { admin, member, other };
}

async function hashOf(userId: string) {
  return (await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash;
}

beforeEach(() => {
  mockUserId.mockReset();
  resetRateLimits();
});

describe('POST /api/admin/users/[id]/password', () => {
  it('lets an admin set a new password and signs the account out everywhere', async () => {
    const { admin, member } = await seed();
    actAs(admin.id);

    const res = await call(member.id, { password: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, signedOutSessions: 2 });

    expect(await verifyPassword(NEW_PASSWORD, await hashOf(member.id))).toBe(true);
    expect(
      await db.authSession.count({ where: { userId: member.id, revokedAt: null } }),
    ).toBe(0);
    // The admin's own session is untouched.
    expect(await db.authSession.count({ where: { userId: admin.id, revokedAt: null } })).toBe(1);
    // A reset link sent before the change no longer works.
    expect(
      await db.passwordResetToken.count({ where: { userId: member.id, usedAt: null } }),
    ).toBe(0);
  });

  it('records who changed which account, without the password', async () => {
    const { admin, member } = await seed();
    actAs(admin.id);
    await call(member.id, { password: NEW_PASSWORD });

    const rows = await db.auditLog.findMany({ where: { entityId: member.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: admin.id,
      entity: 'User',
      action: ADMIN_SET_PASSWORD_ACTION,
      newValue: { signedOutSessions: 2 },
    });
    const stored = JSON.stringify(rows[0]);
    expect(stored).not.toContain(NEW_PASSWORD);
    expect(stored).not.toContain(await hashOf(member.id));
  });

  it('refuses a regular user acting on someone else (cross-user)', async () => {
    const { member, other } = await seed();
    actAs(member.id);

    const res = await call(other.id, { password: NEW_PASSWORD });
    expect(res.status).toBe(403);
    expect(await hashOf(other.id)).toBe('old-other');
    expect(await db.auditLog.count()).toBe(0);
  });

  it('stops working as soon as the admin role is taken away', async () => {
    const { admin, member } = await seed();
    actAs(admin.id);
    await db.user.update({ where: { id: admin.id }, data: { role: 'USER' } });

    const res = await call(member.id, { password: NEW_PASSWORD });
    expect(res.status).toBe(403);
    expect(await hashOf(member.id)).toBe('old-member');
  });

  it('requires a session', async () => {
    const { member } = await seed();
    actAs(null);
    const res = await call(member.id, { password: NEW_PASSWORD });
    expect(res.status).toBe(401);
    expect(await hashOf(member.id)).toBe('old-member');
  });

  it("refuses the admin's own account (Settings checks the current password)", async () => {
    const { admin } = await seed();
    actAs(admin.id);
    const res = await call(admin.id, { password: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect(await hashOf(admin.id)).toBe('old-admin');
    expect(await db.authSession.count({ where: { userId: admin.id, revokedAt: null } })).toBe(1);
  });

  it('answers 404 for an unknown account', async () => {
    const { admin } = await seed();
    actAs(admin.id);
    const res = await call('does-not-exist', { password: NEW_PASSWORD });
    expect(res.status).toBe(404);
    expect(await db.auditLog.count()).toBe(0);
  });

  it('rejects a password under 8 characters and changes nothing', async () => {
    const { admin, member } = await seed();
    actAs(admin.id);
    const res = await call(member.id, { password: 'short' });
    expect(res.status).toBe(400);
    expect(await hashOf(member.id)).toBe('old-member');
    expect(await db.authSession.count({ where: { userId: member.id, revokedAt: null } })).toBe(2);
  });
});

describe('listUsersForAdmin', () => {
  it('lists accounts with role and last activity, and nothing else', async () => {
    const { admin, member, other } = await seed();
    const seen = new Date('2026-10-01T12:00:00.000Z');
    await db.authSession.updateMany({ where: { userId: member.id }, data: { lastSeenAt: seen } });

    const rows = await listUsersForAdmin();
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(admin.id)?.role).toBe('ADMIN');
    expect(byId.get(member.id)).toEqual({
      id: member.id,
      email: 'member@test.dev',
      displayName: null,
      role: 'USER',
      blocked: false,
      createdAt: member.createdAt.toISOString(),
      lastSeenAt: seen.toISOString(),
    });
    expect(byId.get(other.id)?.lastSeenAt).toBeNull();
  });
});
