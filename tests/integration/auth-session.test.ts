import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { createAuthSession, isSessionActive } from '@/lib/auth-session';
import { verifySession } from '@/lib/auth-token';
import { hashPassword, verifyPassword } from '@/lib/password';

// Real Postgres: revocable sessions and the password change route.
vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn() }));

import { getCurrentSession } from '@/lib/auth';
import { POST as changePassword } from '@/app/api/auth/password/route';
import { DELETE as signOutOthers, GET as listSessions } from '@/app/api/auth/sessions/route';

const mockedSession = vi.mocked(getCurrentSession);

beforeAll(() => {
  process.env.JWT_SECRET ??= 'integration-test-secret-at-least-32-chars';
});

async function makeUser(email: string, password = 'old-password-1') {
  return db.user.create({ data: { email, passwordHash: await hashPassword(password) } });
}

async function login(userId: string, email: string) {
  const { token } = await createAuthSession({ userId, email, userAgent: 'vitest' });
  const claims = await verifySession(token);
  if (!claims) throw new Error('token did not verify');
  return claims;
}

function jsonPost(body: unknown) {
  return new Request('http://test.local/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('revocable sessions', () => {
  let user: { id: string; email: string };

  beforeEach(async () => {
    user = await makeUser('ana@example.com');
  });

  it('a fresh session is active and stops being active once revoked', async () => {
    const claims = await login(user.id, user.email);
    await expect(isSessionActive(claims)).resolves.toBe(true);

    await db.authSession.update({ where: { id: claims.sid }, data: { revokedAt: new Date() } });
    await expect(isSessionActive(claims)).resolves.toBe(false);
  });

  it('signing out other devices keeps only the current one active', async () => {
    const phone = await login(user.id, user.email);
    const laptop = await login(user.id, user.email);
    mockedSession.mockResolvedValue(laptop);

    const res = await signOutOthers();
    expect(await res.json()).toMatchObject({ ok: true, signedOutSessions: 1 });
    await expect(isSessionActive(phone)).resolves.toBe(false);
    await expect(isSessionActive(laptop)).resolves.toBe(true);

    const list = await (await listSessions()).json();
    expect(list.sessions).toHaveLength(1);
    expect(list.sessions[0]).toMatchObject({ id: laptop.sid, current: true });
  });

  it('never touches another user', async () => {
    const other = await makeUser('bia@example.com');
    const theirs = await login(other.id, other.email);
    const mine = await login(user.id, user.email);
    mockedSession.mockResolvedValue(mine);

    await signOutOthers();
    await expect(isSessionActive(theirs)).resolves.toBe(true);
  });

  it('deleting the user deletes their sessions', async () => {
    await login(user.id, user.email);
    await db.user.delete({ where: { id: user.id } });
    await expect(db.authSession.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});

describe('POST /api/auth/password', () => {
  it('requires the current password', async () => {
    const user = await makeUser('ana@example.com');
    mockedSession.mockResolvedValue(await login(user.id, user.email));

    const res = await changePassword(
      jsonPost({ currentPassword: 'wrong-password', newPassword: 'new-password-1' }),
    );
    expect(res.status).toBe(400);
  });

  it('changes the password and signs out the other devices', async () => {
    const user = await makeUser('carla@example.com');
    const other = await login(user.id, user.email);
    const current = await login(user.id, user.email);
    mockedSession.mockResolvedValue(current);

    const res = await changePassword(
      jsonPost({ currentPassword: 'old-password-1', newPassword: 'new-password-1' }),
    );
    expect(res.status).toBe(200);

    const saved = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    await expect(verifyPassword('new-password-1', saved.passwordHash)).resolves.toBe(true);
    await expect(isSessionActive(other)).resolves.toBe(false);
    await expect(isSessionActive(current)).resolves.toBe(true);
  });

  it('refuses a password longer than bcrypt can hash', async () => {
    const user = await makeUser('dani@example.com');
    mockedSession.mockResolvedValue(await login(user.id, user.email));

    const res = await changePassword(
      jsonPost({ currentPassword: 'old-password-1', newPassword: 'é'.repeat(40) }),
    );
    expect(res.status).toBe(400);
  });

  it('is unauthorized without a session', async () => {
    mockedSession.mockResolvedValue(null);
    const res = await changePassword(
      jsonPost({ currentPassword: 'x', newPassword: 'new-password-1' }),
    );
    expect(res.status).toBe(401);
  });
});
