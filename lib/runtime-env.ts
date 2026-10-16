import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { isSecretKey, isSettingKey } from '@/lib/admin-settings';
import { openSecret } from '@/lib/secret-box';

// The environment the app runs with: process.env with the values an admin
// set in /admin (AppSetting, AppSecret) on top. Code that reads AI or e-mail
// settings takes this instead of process.env. Cached briefly so a request
// does not cost two queries; a save in the panel clears the cache of the
// replica that served it, and the others pick it up within TTL_MS.

export type Env = Record<string, string | undefined>;

const TTL_MS = 30_000;
// Only the panel's values are cached; process.env is read fresh on each call.
let cached: { overlay: Env; at: number } | null = null;

export async function getRuntimeEnv(now: number = Date.now()): Promise<Env> {
  if (cached && now - cached.at < TTL_MS) return { ...process.env, ...cached.overlay };
  try {
    const [settings, secrets] = await Promise.all([
      db.appSetting.findMany({ select: { key: true, value: true } }),
      db.appSecret.findMany({ select: { key: true, ciphertext: true } }),
    ]);
    const overlay: Env = {};
    for (const row of settings) {
      if (isSettingKey(row.key)) overlay[row.key] = row.value;
    }
    for (const row of secrets) {
      // A key sealed under another server secret is skipped: the environment
      // variable, if any, applies, and the panel flags the key as unreadable.
      const plain = isSecretKey(row.key) ? openSecret(row.ciphertext) : null;
      if (plain) overlay[row.key] = plain;
    }
    cached = { overlay, at: now };
    return { ...process.env, ...overlay };
  } catch (err) {
    // Settings must never take the app down: fall back to the environment.
    log.warn('runtime_env.load_failed', { err });
    return process.env;
  }
}

export function invalidateRuntimeEnv(): void {
  cached = null;
}
