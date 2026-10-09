import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { saveOnboarding, skipOnboarding } from '@/lib/onboarding';
import { onboardingSchema } from '@/lib/schemas/onboarding';

// POST /api/onboarding: saves the onboarding answers for the signed-in user.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const input = await parseJsonBody(req, onboardingSchema);
    await saveOnboarding(userId, input);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/onboarding: "skip for now", hides the onboarding prompt.
export async function DELETE() {
  try {
    const userId = await requireApiUserId();
    await skipOnboarding(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
