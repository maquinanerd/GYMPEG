// Outgoing e-mail behind one small interface, picked by EMAIL_PROVIDER:
// - resend: Resend HTTP API (RESEND_API_KEY, EMAIL_FROM); no SDK needed;
// - log: prints the message to the server log, refused in production because
//   a reset link in a log is a credential leak;
// - unset or unknown: no provider; features that need e-mail say so.
// A new provider only has to implement EmailProvider and be added below.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<void>;
}

type Env = Record<string, string | undefined>;

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function resendProvider(apiKey: string, from: string): EmailProvider {
  return {
    name: 'resend',
    async send(message) {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      // The status alone: the body may echo the recipient.
      if (!res.ok) throw new Error(`E-mail provider rejected the message (HTTP ${res.status}).`);
    },
  };
}

const logProvider: EmailProvider = {
  name: 'log',
  async send(message) {
    console.info(`[email:log] to=${message.to} subject=${message.subject}\n${message.text}`);
  },
};

export function getEmailProvider(env: Env = process.env): EmailProvider | null {
  const kind = env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (kind === 'resend') {
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.EMAIL_FROM?.trim();
    return apiKey && from ? resendProvider(apiKey, from) : null;
  }
  if (kind === 'log') return env.NODE_ENV === 'production' ? null : logProvider;
  return null;
}

// Whether the app can e-mail a working link right now (a provider and, in
// production, a configured public origin).
export function canSendAppLinks(env: Env = process.env): boolean {
  if (!getEmailProvider(env)) return false;
  return env.NODE_ENV !== 'production' || resolvePublicAppUrl(env) != null;
}

// Public origin used in links sent by e-mail. Never taken from the request's
// Host header (a forged header would point the link at another site); outside
// production the request origin is an acceptable fallback.
export function resolvePublicAppUrl(env: Env = process.env, requestOrigin?: string): string | null {
  for (const value of [env.APP_URL, env.NEXTAUTH_URL]) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // Ignore a malformed value and try the next one.
    }
  }
  return env.NODE_ENV === 'production' ? null : (requestOrigin ?? null);
}
