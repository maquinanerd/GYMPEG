import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// Edge-safe session token helpers (jose only, no Prisma): imported by the
// middleware, which runs on the edge runtime and can only check the token
// signature. Whether the session behind the token is still active (not
// revoked, not expired) is checked against the database by lib/auth.ts in
// server components and API routes, i.e. everywhere data is read or written.

export const SESSION_COOKIE = 'gymcoach-session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET missing or too short (min 32 chars).');
  }
  return new TextEncoder().encode(secret);
}

export interface SessionClaims extends JWTPayload {
  userId: string;
  email: string;
  // AuthSession row id. Tokens without it (issued before revocable sessions)
  // are rejected server-side, which forces a fresh login.
  sid?: string;
}

export async function signSession(claims: {
  userId: string;
  email: string;
  sid: string;
}): Promise<string> {
  return new SignJWT({ userId: claims.userId, email: claims.email, sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    if (payload.sid !== undefined && typeof payload.sid !== 'string') return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

// Secure by default in production. Self-hosters serving plain HTTP on a
// trusted LAN must opt out explicitly with SESSION_COOKIE_SECURE=false;
// deriving the default from NEXTAUTH_URL would silently drop the flag when
// that variable is left at its example value. The same decision applies to
// every cookie the app sets (the locale cookie reuses it): the flag is never
// derived from ambient request data such as X-Forwarded-Proto, which a client
// can send itself.
export function cookieSecureFlag(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SESSION_COOKIE_SECURE
    ? env.SESSION_COOKIE_SECURE === 'true'
    : env.NODE_ENV === 'production';
}

const sessionCookieSecure = cookieSecureFlag();

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
  secure: sessionCookieSecure,
};
