import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

// Shared limit for the admin API: generous for one person clicking through
// the panel, tight enough to stop a stolen session from scripting it.
export async function adminRateLimit(
  adminId: string,
  bucket: string,
  limit = 30,
  windowMs = 15 * 60_000,
): Promise<NextResponse | null> {
  const rl = await rateLimit(`admin-${bucket}:${adminId}`, limit, windowMs);
  if (rl.ok) return null;
  return NextResponse.json(
    { error: 'Too many attempts. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
  );
}
