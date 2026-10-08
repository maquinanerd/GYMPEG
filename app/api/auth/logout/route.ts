import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/auth-token';
import { revokeAuthSession } from '@/lib/auth-session';

// POST /api/auth/logout: revokes this device's session server-side, so a
// copied cookie stops working too, then clears the cookie. Public: replaying it
// without a cookie does nothing harmful.
export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySession(token) : null;
  if (claims?.sid) {
    try {
      await revokeAuthSession(claims.sid, claims.userId);
    } catch (err) {
      // Still clear the cookie: the user asked to leave this device.
      console.error('[logout] revoke failed:', err);
    }
  }
  jar.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
