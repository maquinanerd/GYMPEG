import { db } from '@/lib/db';

// Liveness + readiness probe for the deployment platform (Coolify healthcheck).
// Public (listed in middleware PUBLIC_PATHS) and deliberately minimal: it never
// returns user data, versions or error details, only whether the app can reach
// its database.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 3000;

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS)),
    ]);
    return Response.json({ status: 'ok' }, { headers });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
