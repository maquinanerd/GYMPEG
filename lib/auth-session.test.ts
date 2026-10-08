// @vitest-environment node
// jose rejects the jsdom realm's Uint8Array; signing needs the node environment.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    authSession: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
      create: (...a: unknown[]) => create(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));

const { createAuthSession, isSessionActive, revokeOtherAuthSessions } =
  await import('./auth-session');
const { verifySession, SESSION_TTL_SECONDS } = await import('./auth-token');

const NOW = new Date('2026-10-08T12:00:00Z');
const claims = { userId: 'u1', email: 'a@b.com', sid: 's1' };

beforeAll(() => {
  process.env.JWT_SECRET = 'unit-test-secret-that-is-at-least-32-chars';
});

afterEach(() => {
  vi.clearAllMocks();
});

function row(
  over: Partial<{ userId: string; revokedAt: Date | null; expiresAt: Date; lastSeenAt: Date }>,
) {
  return {
    userId: 'u1',
    revokedAt: null,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    lastSeenAt: NOW,
    ...over,
  };
}

describe('createAuthSession', () => {
  it('stores a row expiring with the token and signs its id into the token', async () => {
    create.mockResolvedValue({ id: 'sess-123' });
    const { token, sessionId } = await createAuthSession({
      userId: 'u1',
      email: 'a@b.com',
      userAgent: 'x'.repeat(400),
      now: NOW,
    });

    expect(sessionId).toBe('sess-123');
    const data = create.mock.calls[0]![0].data;
    expect(data.expiresAt).toEqual(new Date(NOW.getTime() + SESSION_TTL_SECONDS * 1000));
    expect(data.userAgent).toHaveLength(255);
    expect(await verifySession(token)).toMatchObject({ userId: 'u1', sid: 'sess-123' });
  });
});

describe('isSessionActive', () => {
  it('accepts an active session of the same user', async () => {
    findUnique.mockResolvedValue(row({}));
    await expect(isSessionActive(claims, NOW)).resolves.toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects tokens without a session id without touching the database', async () => {
    await expect(isSessionActive({ userId: 'u1', email: 'a@b.com' }, NOW)).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects missing, revoked, expired and foreign sessions', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(isSessionActive(claims, NOW)).resolves.toBe(false);
    findUnique.mockResolvedValueOnce(row({ revokedAt: NOW }));
    await expect(isSessionActive(claims, NOW)).resolves.toBe(false);
    findUnique.mockResolvedValueOnce(row({ expiresAt: NOW }));
    await expect(isSessionActive(claims, NOW)).resolves.toBe(false);
    findUnique.mockResolvedValueOnce(row({ userId: 'someone-else' }));
    await expect(isSessionActive(claims, NOW)).resolves.toBe(false);
  });

  it('refreshes lastSeenAt at most hourly and never fails on a touch error', async () => {
    update.mockRejectedValue(new Error('db down'));
    findUnique.mockResolvedValue(row({ lastSeenAt: new Date(NOW.getTime() - 2 * 3_600_000) }));
    await expect(isSessionActive(claims, NOW)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { lastSeenAt: NOW } });
  });
});

describe('revokeOtherAuthSessions', () => {
  it('keeps the current session and revokes the rest of the user', async () => {
    updateMany.mockResolvedValue({ count: 2 });
    await expect(revokeOtherAuthSessions('u1', 's1')).resolves.toBe(2);
    expect(updateMany.mock.calls[0]![0].where).toEqual({
      userId: 'u1',
      revokedAt: null,
      id: { not: 's1' },
    });
  });
});
