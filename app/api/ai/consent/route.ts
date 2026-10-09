import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { AI_CONSENT_VERSION, hasAiConsent } from '@/lib/ai/features';

// GET /api/ai/consent: whether the lifter accepted the current AI notice.
export async function GET() {
  try {
    const userId = await requireApiUserId();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { aiConsentAt: true, aiConsentVersion: true },
    });
    return NextResponse.json({
      consented: hasAiConsent(user),
      version: AI_CONSENT_VERSION,
      acceptedAt: user?.aiConsentAt ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const bodySchema = z.object({ version: z.literal(AI_CONSENT_VERSION) });

// POST /api/ai/consent: accepts the notice of this exact version (a stale
// screen showing an older notice cannot accept the new one).
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    await parseJsonBody(req, bodySchema);
    const acceptedAt = new Date();
    await db.user.update({
      where: { id: userId },
      data: { aiConsentAt: acceptedAt, aiConsentVersion: AI_CONSENT_VERSION },
    });
    return NextResponse.json({ consented: true, version: AI_CONSENT_VERSION, acceptedAt });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/ai/consent: withdraws it; AI features stop until accepted again.
export async function DELETE() {
  try {
    const userId = await requireApiUserId();
    await db.user.update({
      where: { id: userId },
      data: { aiConsentAt: null, aiConsentVersion: null },
    });
    return NextResponse.json({ consented: false, version: AI_CONSENT_VERSION, acceptedAt: null });
  } catch (err) {
    return handleApiError(err);
  }
}
