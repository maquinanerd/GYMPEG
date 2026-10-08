import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSessionActive } from '@/lib/auth-session';
import { SESSION_COOKIE, verifySession, type SessionClaims } from '@/lib/auth-token';

// Server-side session helpers (Node runtime: server components and API
// routes). The middleware only checks the token signature on the edge; here
// the session row is checked too, so a revoked or expired session loses
// access to every page and API route on its very next request.

export {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_TTL_SECONDS,
  cookieSecureFlag,
  signSession,
  verifySession,
  type SessionClaims,
} from '@/lib/auth-token';

// Memoized per request in server components (layout and page both ask).
export const getCurrentSession = cache(async (): Promise<SessionClaims | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;
  return (await isSessionActive(claims)) ? claims : null;
});

// Public route that clears the stale cookie and sends the browser to /login.
// Redirecting straight to /login would loop: the middleware only sees a
// validly signed token and bounces /login back to the app.
export const SESSION_EXPIRED_PATH = '/api/auth/session-expired';

// For pages: a missing, revoked or expired session redirects to login
// instead of failing the render.
export async function requireSession(): Promise<SessionClaims> {
  const session = await getCurrentSession();
  if (!session) {
    redirect(SESSION_EXPIRED_PATH);
  }
  return session;
}

// Handy shortcut in the API routes: returns the userId or null.
// The middleware already blocks protected routes with a 401 JSON,
// but we keep this handler-side guard for edge cases (token expired
// between the middleware check and arriving here, a revoked session, or a
// route missing from the matcher).
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.userId ?? null;
}
