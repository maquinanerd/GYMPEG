import { db } from '@/lib/db';
import { recordAudit } from '@/lib/admin';
import {
  SECRET_KEYS,
  SETTING_KEYS,
  isSecretKey,
  isSettingKey,
  type SecretKey,
  type SettingKey,
} from '@/lib/admin-settings';
import { getEmailProvider } from '@/lib/email';
import { createProvider, LlmError, type LlmProviderId } from '@/lib/llm';
import { invalidateRuntimeEnv, type Env } from '@/lib/runtime-env';
import { lastFour, openSecret, sealSecret } from '@/lib/secret-box';

// The settings side of the admin panel: what is set where (panel or
// environment), saving and clearing values and keys, and the connection
// tests. Saved values reach the app through lib/runtime-env.

export interface SettingView {
  // Value saved in the panel; null = not set there.
  panel: string | null;
  // Value from the environment (Coolify), shown so the admin knows what
  // applies when the panel is empty.
  env: string | null;
}

export interface SecretView {
  panel: {
    last4: string;
    // False when it was sealed under another server secret: it no longer
    // works and must be entered again.
    readable: boolean;
    updatedAt: string;
  } | null;
  // Only whether the environment has one; its value never leaves the server.
  envConfigured: boolean;
}

export interface AdminConfigView {
  settings: Record<SettingKey, SettingView>;
  secrets: Record<SecretKey, SecretView>;
}

export async function getAdminConfigView(env: Env = process.env): Promise<AdminConfigView> {
  const [settingRows, secretRows] = await Promise.all([
    db.appSetting.findMany(),
    db.appSecret.findMany(),
  ]);
  const panelSettings = new Map(settingRows.map((row) => [row.key, row.value]));
  const panelSecrets = new Map(secretRows.map((row) => [row.key, row]));

  const settings = Object.fromEntries(
    SETTING_KEYS.map((key) => [
      key,
      { panel: panelSettings.get(key) ?? null, env: env[key]?.trim() || null },
    ]),
  ) as Record<SettingKey, SettingView>;

  const secrets = Object.fromEntries(
    SECRET_KEYS.map((key) => {
      const row = panelSecrets.get(key);
      return [
        key,
        {
          panel: row
            ? {
                last4: row.last4,
                readable: openSecret(row.ciphertext, env) !== null,
                updatedAt: row.updatedAt.toISOString(),
              }
            : null,
          envConfigured: Boolean(env[key]?.trim()),
        },
      ];
    }),
  ) as Record<SecretKey, SecretView>;

  return { settings, secrets };
}

// Saves or clears (null) panel values. Only keys that actually change are
// written and audited, with their old and new values (never secrets here).
export async function updateSettingsAsAdmin(
  adminId: string,
  changes: Partial<Record<SettingKey, string | null>>,
): Promise<number> {
  const keys = Object.keys(changes).filter(isSettingKey);
  if (keys.length === 0) return 0;
  const current = new Map(
    (await db.appSetting.findMany({ where: { key: { in: keys } } })).map((row) => [
      row.key,
      row.value,
    ]),
  );
  let changed = 0;
  await db.$transaction(async (tx) => {
    for (const key of keys) {
      const next = changes[key] ?? null;
      const previous = current.get(key) ?? null;
      if (next === previous) continue;
      if (next === null) {
        await tx.appSetting.delete({ where: { key } });
      } else {
        await tx.appSetting.upsert({
          where: { key },
          create: { key, value: next, updatedById: adminId },
          update: { value: next, updatedById: adminId },
        });
      }
      await recordAudit(tx, {
        actorUserId: adminId,
        entity: 'AppSetting',
        entityId: key,
        action: 'SETTING_UPDATE',
        oldValue: { value: previous },
        newValue: { value: next },
      });
      changed += 1;
    }
  });
  invalidateRuntimeEnv();
  return changed;
}

// Saves (sealed) or clears an API key. The audit row says which key and
// when, nothing of its value.
export async function setSecretAsAdmin(
  adminId: string,
  key: SecretKey,
  value: string | null,
): Promise<void> {
  if (!isSecretKey(key)) throw new Error(`Unknown secret ${key}`);
  await db.$transaction(async (tx) => {
    if (value === null) {
      const removed = await tx.appSecret.deleteMany({ where: { key } });
      if (removed.count === 0) return;
    } else {
      const data = { ciphertext: sealSecret(value), last4: lastFour(value), updatedById: adminId };
      await tx.appSecret.upsert({ where: { key }, create: { key, ...data }, update: data });
    }
    await recordAudit(tx, {
      actorUserId: adminId,
      entity: 'AppSecret',
      entityId: key,
      action: value === null ? 'SECRET_CLEAR' : 'SECRET_SET',
    });
  });
  invalidateRuntimeEnv();
}

export type ConnectionTest =
  | { ok: true; latencyMs: number; model: string }
  | { ok: false; reason: 'not_configured' | 'failed'; status?: number; message?: string };

const TEST_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new LlmError(504, 'The provider did not answer in time.')), TEST_TIMEOUT_MS),
    ),
  ]);
}

// One tiny request to a provider with the current settings, to check a key
// and a model before switching to them. Costs a handful of tokens.
export async function testAiProvider(id: LlmProviderId, env: Env): Promise<ConnectionTest> {
  const provider = createProvider(id, env);
  if (!provider.isConfigured()) return { ok: false, reason: 'not_configured' };
  const started = Date.now();
  try {
    const result = await withTimeout(
      provider.complete({
        system: 'Connection check. Answer with the single word OK.',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 16,
      }),
    );
    return { ok: true, latencyMs: Date.now() - started, model: result.modelUsed };
  } catch (err) {
    // LlmError messages are written by the provider layer, never a raw body.
    return err instanceof LlmError
      ? { ok: false, reason: 'failed', status: err.status, message: err.message.slice(0, 200) }
      : { ok: false, reason: 'failed' };
  }
}

export type EmailTest = { ok: true } | { ok: false; reason: 'not_configured' | 'failed' };

// Sends a test message to the admin's own address with the current settings.
export async function sendTestEmail(
  message: { to: string; subject: string; text: string },
  env: Env,
): Promise<EmailTest> {
  const provider = getEmailProvider(env);
  if (!provider) return { ok: false, reason: 'not_configured' };
  try {
    await provider.send(message);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
