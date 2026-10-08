import { cache } from 'react';
import { getCurrentSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { DEFAULT_TIME_ZONE, safeTimeZone } from '@/lib/timezone';

// The user's IANA time zone, validated (an unknown stored value falls back to
// UTC rather than breaking an aggregation).
export async function getUserTimeZone(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return safeTimeZone(user?.timezone ?? DEFAULT_TIME_ZONE);
}

// Zone for formatting dates in the current request (next-intl): the signed-in
// user's zone, or the product default for signed-out pages. Memoized per
// request.
export const getRequestTimeZone = cache(async (): Promise<string> => {
  const session = await getCurrentSession();
  if (!session) return DEFAULT_TIME_ZONE;
  return getUserTimeZone(session.userId);
});
