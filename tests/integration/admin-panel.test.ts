import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { verifyPassword, hashPassword } from '@/lib/password';
import { resetRateLimits } from '@/lib/rate-limit';
import { isAdmin } from '@/lib/admin';
import { getAdminConfigView } from '@/lib/admin-config';
import { getAiUsageSummary, getOverviewStats, listAuditLog } from '@/lib/admin-stats';
import { isSessionActive } from '@/lib/auth-session';
import { authenticateMcpRequest, generateMcpToken, hashMcpToken } from '@/lib/mcp/auth';
import { issuePasswordReset } from '@/lib/password-reset';
import { getLlmProvider } from '@/lib/llm';
import { getRuntimeEnv, invalidateRuntimeEnv } from '@/lib/runtime-env';

// The admin panel (/admin): accounts (create, block, role, delete), instance
// settings and encrypted API keys layered over the environment, connection
// tests and the read-only figures. Every route is admins only.

process.env.JWT_SECRET ??= 'integration-test-secret-at-least-32-characters';

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn(), requireSession: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
}));

import { POST as createUser } from '@/app/api/admin/users/route';
import { PATCH as updateUser, DELETE as deleteUser } from '@/app/api/admin/users/[id]/route';
import { PUT as putSettings } from '@/app/api/admin/settings/route';
import { PUT as putSecret } from '@/app/api/admin/secrets/route';
import { POST as testAi } from '@/app/api/admin/ai/test/route';
import { POST as testEmail } from '@/app/api/admin/email/test/route';
import { POST as login } from '@/app/api/auth/login/route';

function json(method: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://test.local/api', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const future = () => new Date(Date.now() + 60 * 60_000);

async function seed() {
  const [admin, member] = await Promise.all([
    db.user.create({
      data: { email: 'admin@test.dev', passwordHash: 'x', role: 'ADMIN' },
    }),
    db.user.create({
      data: { email: 'member@test.dev', passwordHash: await hashPassword('member-password') },
    }),
  ]);
  return { admin, member };
}

function loginAs(email: string, password: string) {
  return login(json('POST', { email, password }, { 'x-forwarded-for': `10.1.${Math.floor(Math.random() * 250)}.1` }));
}

beforeEach(() => {
  mockUserId.mockReset();
  resetRateLimits();
  invalidateRuntimeEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  invalidateRuntimeEnv();
});

describe('admin accounts', () => {
  it('creates an account outside the invite list, ready to sign in', async () => {
    const { admin } = await seed();
    mockUserId.mockResolvedValue(admin.id);

    const res = await createUser(
      json('POST', { email: 'new@test.dev', password: 'first-password', displayName: 'Ana' }),
    );
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user).toMatchObject({ email: 'new@test.dev', displayName: 'Ana', role: 'USER' });
    expect(await verifyPassword('first-password', user.passwordHash)).toBe(true);
    expect((await loginAs('new@test.dev', 'first-password')).status).toBe(200);

    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: id } });
    expect(audit).toMatchObject({ actorUserId: admin.id, action: 'ADMIN_CREATE_USER' });
    expect(JSON.stringify(audit)).not.toContain('first-password');

    const again = await createUser(json('POST', { email: 'new@test.dev', password: 'other-password' }));
    expect(again.status).toBe(409);
  });

  it('refuses every admin route to a regular user (cross-user)', async () => {
    const { admin, member } = await seed();
    mockUserId.mockResolvedValue(member.id);

    expect((await createUser(json('POST', { email: 'x@test.dev', password: 'password-123' }))).status).toBe(403);
    expect((await updateUser(json('PATCH', { blocked: true }), params(admin.id))).status).toBe(403);
    expect(
      (await deleteUser(json('DELETE', { confirmEmail: admin.email }), params(admin.id))).status,
    ).toBe(403);
    expect((await putSettings(json('PUT', { settings: { AI_PROVIDER: 'demo' } }))).status).toBe(403);
    expect((await putSecret(json('PUT', { key: 'GEMINI_API_KEY', value: 'AIza-secret-123' }))).status).toBe(403);
    expect((await testAi(json('POST', { provider: 'demo' }))).status).toBe(403);
    expect((await testEmail()).status).toBe(403);

    expect(await db.user.findUnique({ where: { id: admin.id } })).toMatchObject({ blockedAt: null });
    expect(await db.appSetting.count()).toBe(0);
    expect(await db.appSecret.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });

  it('blocking shuts every door: sessions, MCP tokens, login and reset links', async () => {
    const { admin, member } = await seed();
    const session = await db.authSession.create({ data: { userId: member.id, expiresAt: future() } });
    const token = generateMcpToken();
    await db.mcpAccessToken.create({
      data: { userId: member.id, name: 'claude', tokenHash: hashMcpToken(token), tokenPrefix: 'gmc_x' },
    });
    mockUserId.mockResolvedValue(admin.id);

    const res = await updateUser(json('PATCH', { blocked: true }), params(member.id));
    expect(res.status).toBe(200);

    const claims = { userId: member.id, email: member.email, sid: session.id };
    await expect(isSessionActive(claims)).resolves.toBe(false);
    const mcpReq = new Request('http://test.local/mcp', { headers: { Authorization: `Bearer ${token}` } });
    await expect(authenticateMcpRequest(mcpReq)).resolves.toBeNull();

    const refused = await loginAs(member.email, 'member-password');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'ACCOUNT_BLOCKED' });
    // A wrong password still gets the generic answer: blocking is not revealed.
    expect((await loginAs(member.email, 'wrong-password')).status).toBe(401);
    await expect(issuePasswordReset(member.email, 'https://gympeg.test')).resolves.toBeNull();

    // Even a session row created afterwards does not get in.
    const late = await db.authSession.create({ data: { userId: member.id, expiresAt: future() } });
    await expect(isSessionActive({ ...claims, sid: late.id })).resolves.toBe(false);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'ADMIN_BLOCK_USER' } });
    expect(audit).toMatchObject({ entityId: member.id, newValue: { signedOutSessions: 1 } });

    expect((await updateUser(json('PATCH', { blocked: false }), params(member.id))).status).toBe(200);
    expect((await loginAs(member.email, 'member-password')).status).toBe(200);
  });

  it('changes the role, recording the old and the new one', async () => {
    const { admin, member } = await seed();
    mockUserId.mockResolvedValue(admin.id);

    expect((await updateUser(json('PATCH', { role: 'ADMIN' }), params(member.id))).status).toBe(200);
    await expect(isAdmin(member.id)).resolves.toBe(true);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'ADMIN_SET_ROLE' } });
    expect(audit).toMatchObject({ oldValue: { role: 'USER' }, newValue: { role: 'ADMIN' } });

    // A blocked admin is no admin.
    await db.user.update({ where: { id: member.id }, data: { blockedAt: new Date() } });
    await expect(isAdmin(member.id)).resolves.toBe(false);
  });

  it('never lets an admin block, demote or delete their own account', async () => {
    const { admin } = await seed();
    mockUserId.mockResolvedValue(admin.id);

    expect((await updateUser(json('PATCH', { blocked: true }), params(admin.id))).status).toBe(400);
    expect((await updateUser(json('PATCH', { role: 'USER' }), params(admin.id))).status).toBe(400);
    expect(
      (await deleteUser(json('DELETE', { confirmEmail: admin.email }), params(admin.id))).status,
    ).toBe(400);
    expect(await db.user.findUniqueOrThrow({ where: { id: admin.id } })).toMatchObject({
      role: 'ADMIN',
      blockedAt: null,
    });
  });

  it('deletes an account only when its e-mail is retyped', async () => {
    const { admin, member } = await seed();
    mockUserId.mockResolvedValue(admin.id);

    const wrong = await deleteUser(json('DELETE', { confirmEmail: 'other@test.dev' }), params(member.id));
    expect(wrong.status).toBe(400);
    expect(await db.user.count({ where: { id: member.id } })).toBe(1);

    const ok = await deleteUser(json('DELETE', { confirmEmail: member.email }), params(member.id));
    expect(ok.status).toBe(200);
    expect(await db.user.count({ where: { id: member.id } })).toBe(0);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'ADMIN_DELETE_USER' } });
    expect(audit.entityId).toBe(member.id);
    expect(JSON.stringify(audit)).not.toContain(member.email);
    expect((await listAuditLog())[0]).toMatchObject({ targetEmail: null, actorEmail: admin.email });
  });
});

describe('admin settings and keys', () => {
  it('rejects invalid values and writes nothing', async () => {
    const { admin } = await seed();
    mockUserId.mockResolvedValue(admin.id);
    for (const settings of [
      { AI_PROVIDER: 'skynet' },
      { GEMINI_MODEL: 'bad model id' },
      { AI_FEATURES_DISABLED: 'ai.unknown' },
      { AI_COST_PER_MTOKEN_INPUT: '-1' },
      { EMAIL_FROM: 'not an address' },
      { DATABASE_URL: 'postgres://elsewhere' },
    ]) {
      expect((await putSettings(json('PUT', { settings }))).status).toBe(400);
    }
    expect(await db.appSetting.count()).toBe(0);
  });

  it('layers saved settings over the environment, and clearing restores it', async () => {
    const { admin } = await seed();
    mockUserId.mockResolvedValue(admin.id);
    vi.stubEnv('AI_PROVIDER', 'deepseek');
    vi.stubEnv('GEMINI_MODEL', 'env-model');

    const res = await putSettings(
      json('PUT', { settings: { AI_PROVIDER: 'gemini', GEMINI_MODEL: 'gemini-pro-x', EMAIL_PROVIDER: 'off' } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ changed: 3 });
    const env = await getRuntimeEnv();
    expect(env).toMatchObject({ AI_PROVIDER: 'gemini', GEMINI_MODEL: 'gemini-pro-x', EMAIL_PROVIDER: 'off' });
    expect(getLlmProvider(env)).toMatchObject({ id: 'gemini', model: 'gemini-pro-x' });

    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: 'GEMINI_MODEL' } });
    expect(audit).toMatchObject({ oldValue: { value: null }, newValue: { value: 'gemini-pro-x' } });

    // Saving the same value again changes nothing and records nothing.
    const same = await putSettings(json('PUT', { settings: { AI_PROVIDER: 'gemini' } }));
    expect(await same.json()).toMatchObject({ changed: 0 });

    await putSettings(json('PUT', { settings: { AI_PROVIDER: null, GEMINI_MODEL: null } }));
    const restored = await getRuntimeEnv();
    expect(restored.AI_PROVIDER).toBe('deepseek');
    expect(restored.GEMINI_MODEL).toBe('env-model');
    expect(await db.auditLog.count({ where: { action: 'SETTING_UPDATE' } })).toBe(5);
  });

  it('keeps API keys encrypted and never echoes them back', async () => {
    const { admin } = await seed();
    mockUserId.mockResolvedValue(admin.id);
    const key = 'AIzaSy-panel-key-9876';

    const res = await putSecret(json('PUT', { key: 'GEMINI_API_KEY', value: key }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, last4: '9876' });

    const row = await db.appSecret.findUniqueOrThrow({ where: { key: 'GEMINI_API_KEY' } });
    expect(row.ciphertext).not.toContain('panel-key');
    expect(row.last4).toBe('9876');

    const env = await getRuntimeEnv();
    expect(env.GEMINI_API_KEY).toBe(key);
    await putSettings(json('PUT', { settings: { AI_PROVIDER: 'gemini' } }));
    expect(getLlmProvider(await getRuntimeEnv()).isConfigured()).toBe(true);

    const view = await getAdminConfigView();
    expect(view.secrets.GEMINI_API_KEY.panel).toMatchObject({ last4: '9876', readable: true });
    expect(JSON.stringify(view)).not.toContain(key);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'SECRET_SET' } });
    expect(JSON.stringify(audit)).not.toContain('9876');

    expect((await putSecret(json('PUT', { key: 'GEMINI_API_KEY', value: null }))).status).toBe(200);
    expect(await db.appSecret.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: 'SECRET_CLEAR' } })).toBe(1);
  });

  it('flags a key sealed under another server secret instead of using it', async () => {
    const { admin } = await seed();
    mockUserId.mockResolvedValue(admin.id);
    await putSecret(json('PUT', { key: 'DEEPSEEK_API_KEY', value: 'sk-deepseek-1234' }));

    vi.stubEnv('JWT_SECRET', 'a-rotated-server-secret-also-32-chars');
    invalidateRuntimeEnv();
    expect((await getRuntimeEnv()).DEEPSEEK_API_KEY).toBeUndefined();
    const view = await getAdminConfigView();
    expect(view.secrets.DEEPSEEK_API_KEY.panel).toMatchObject({ readable: false });
  });

  it('tests a provider and the e-mail with the saved settings', async () => {
    const { admin } = await seed();
    mockUserId.mockResolvedValue(admin.id);

    const demo = await testAi(json('POST', { provider: 'demo' }));
    expect(await demo.json()).toMatchObject({ ok: true });
    const keyless = await testAi(json('POST', { provider: 'anthropic' }));
    expect(await keyless.json()).toMatchObject({ ok: false, reason: 'not_configured' });

    expect(await (await testEmail()).json()).toEqual({ ok: false, reason: 'not_configured' });
    vi.stubEnv('EMAIL_PROVIDER', 'log');
    invalidateRuntimeEnv();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    expect(await (await testEmail()).json()).toEqual({ ok: true });
    expect(info).toHaveBeenCalledWith(expect.stringContaining('to=admin@test.dev'));
    info.mockRestore();
  });
});

describe('admin figures', () => {
  it('counts accounts, training and AI usage without personal data', async () => {
    const { admin, member } = await seed();
    await db.user.update({ where: { id: member.id }, data: { blockedAt: new Date() } });
    await db.session.create({
      data: { userId: member.id, startedAt: new Date(), finishedAt: new Date() },
    });
    await db.aIUsage.createMany({
      data: [
        { userId: admin.id, provider: 'gemini', model: 'g', operation: 'CHAT', latencyMs: 100, success: true, inputTokens: 10, outputTokens: 5, estimatedCost: 0.5 },
        { userId: admin.id, provider: 'gemini', model: 'g', operation: 'CHAT', latencyMs: 300, success: false },
      ],
    });

    const stats = await getOverviewStats();
    expect(stats).toMatchObject({
      accounts: 2,
      newAccounts7d: 2,
      admins: 1,
      blocked: 1,
      activeLifters7d: 1,
      workouts7d: 1,
      aiCalls7d: 2,
      aiFailures7d: 1,
      aiCost7d: 0.5,
    });

    const usage = await getAiUsageSummary(30);
    expect(usage.total).toMatchObject({ calls: 2, failures: 1, inputTokens: 10, outputTokens: 5, avgLatencyMs: 200 });
    expect(usage.byModel).toEqual([
      expect.objectContaining({ provider: 'gemini', model: 'g', calls: 2, failures: 1 }),
    ]);
    expect(usage.byOperation).toEqual([expect.objectContaining({ operation: 'CHAT', calls: 2 })]);
  });
});
