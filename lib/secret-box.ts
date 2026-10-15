import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

// Encryption for the API keys an admin enters in /admin (AppSecret). AES-256-GCM
// under a key derived (HKDF-SHA256) from APP_SECRETS_KEY, or from JWT_SECRET
// when that is not set, so a database dump alone does not reveal the keys.
// Changing the source secret makes the stored keys unreadable: the panel then
// reports them as such and they have to be entered again.

type Env = Record<string, string | undefined>;

const VERSION = 'v1';
const IV_BYTES = 12;

function deriveKey(env: Env): Buffer {
  const source = env.APP_SECRETS_KEY?.trim() || env.JWT_SECRET?.trim();
  if (!source || source.length < 32) {
    throw new Error('APP_SECRETS_KEY or JWT_SECRET (at least 32 characters) is required.');
  }
  return Buffer.from(hkdfSync('sha256', source, 'gympeg-app-secrets', VERSION, 32));
}

export function sealSecret(plain: string, env: Env = process.env): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(env), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(
    ':',
  );
}

// Null when the value was sealed under another secret or was tampered with.
export function openSecret(sealed: string, env: Env = process.env): string | null {
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(env), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

// What the panel shows of a key: its last 4 characters.
export function lastFour(value: string): string {
  return value.trim().slice(-4);
}
