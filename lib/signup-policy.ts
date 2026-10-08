// Who may create an account (SIGNUP_MODE):
// - open: anyone (default outside production, so dev and tests just work);
// - allowlist: only emails listed in SIGNUP_ALLOWED_EMAILS (default in
//   production, so a freshly deployed instance is never open to the world);
// - closed: nobody.
// The check runs before any database lookup so a refused signup reveals
// nothing about which emails already have an account.

export type SignupMode = 'open' | 'allowlist' | 'closed';

type Env = Record<string, string | undefined>;

export function resolveSignupMode(env: Env = process.env): SignupMode {
  const raw = env.SIGNUP_MODE?.trim().toLowerCase();
  if (raw === 'open' || raw === 'allowlist' || raw === 'closed') return raw;
  return env.NODE_ENV === 'production' ? 'allowlist' : 'open';
}

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function allowedSignupEmails(env: Env = process.env): Set<string> {
  return new Set(
    (env.SIGNUP_ALLOWED_EMAILS ?? '')
      .split(/[,\s;]+/)
      .map(normalizeSignupEmail)
      .filter((e) => e.length > 0),
  );
}

export function isSignupAllowed(email: string, env: Env = process.env): boolean {
  const mode = resolveSignupMode(env);
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  return allowedSignupEmails(env).has(normalizeSignupEmail(email));
}
