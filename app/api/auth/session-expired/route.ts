import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth-token';

// GET /api/auth/session-expired: public (middleware PUBLIC_PATHS). Pages
// redirect here when their session was revoked or expired: the stale cookie is
// deleted first, otherwise the middleware would keep bouncing /login back into
// the app because the token signature alone is still valid.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
