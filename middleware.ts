import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth-token';
import { buildContentSecurityPolicy, generateNonce, NONCE_HEADER } from '@/lib/csp';

// Routes reachable without a valid session.
// /api/auth/logout is public: replaying it without a cookie does nothing
// harmful and lets the client clear state even if the JWT has expired.
// /~offline is the service worker's offline page: precached at install, it
// carries no account data (it reads only this device's IndexedDB).
const PUBLIC_PATHS = new Set([
  '/login',
  '/signup',
  '/~offline',
  '/mcp',
  '/mcp/health',
  '/api/health',
  '/api/locale',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/session-expired',
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const verified = token ? await verifySession(token) : null;
  // Tokens issued before revocable sessions carry no session id: treat them as
  // signed out here so they go straight to /login.
  const session = verified?.sid ? verified : null;

  // A fresh nonce per request (lib/csp). The request copy lets Next.js and the
  // root layout stamp it on their scripts; the response copy is enforced.
  const nonce = generateNonce();
  const policy = buildContentSecurityPolicy(nonce, {
    dev: process.env.NODE_ENV === 'development',
  });
  const withPolicy = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', policy);
    return res;
  };
  const pass = () => {
    const headers = new Headers(req.headers);
    headers.set(NONCE_HEADER, nonce);
    headers.set('Content-Security-Policy', policy);
    return withPolicy(NextResponse.next({ request: { headers } }));
  };

  if (isPublic) {
    // Already signed in and visiting /login or /signup: send to the dashboard.
    if (session && (pathname === '/login' || pathname === '/signup')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return withPolicy(NextResponse.redirect(url));
    }
    return pass();
  }

  if (!session) {
    // API: 401 JSON. Pages: redirect to /login.
    if (pathname.startsWith('/api/')) {
      return withPolicy(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return withPolicy(NextResponse.redirect(url));
  }

  return pass();
}

export const config = {
  matcher: [
    // Exclude static resources and PWA assets. /exercise-media holds the
    // public-domain technique frames: they must be reachable without a
    // session because the next/image optimizer fetches the source file
    // through a cookie-less internal request. Redirecting that request to
    // /login handed the optimizer an HTML page and every optimized frame
    // (the live-session strip thumbnails) came back as a 400 in production.
    // fallback-*.js is the service worker's offline-fallback script: imported
    // during install, which also happens on /login, before any session.
    '/((?!_next/static|_next/image|exercise-media/|icons|manifest.json|favicon.ico|sw.js|workbox-|fallback-).*)',
  ],
};
