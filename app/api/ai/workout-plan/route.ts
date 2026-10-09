import { NextResponse } from 'next/server';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { requireAiAccess } from '@/lib/ai/gate';
import { generateWorkoutPlan } from '@/lib/ai/planner';
import { LlmError } from '@/lib/llm';
import { rateLimit } from '@/lib/rate-limit';

const bodySchema = z.object({
  request: z.string().trim().max(2000).default(''),
  // Client-generated, so a retried request returns the same plan.
  idempotencyKey: z.string().uuid().optional(),
});

// POST /api/ai/workout-plan: generates and validates a plan for the preview.
// Nothing is saved; the lifter confirms with /api/ai/workout-plan/confirm.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    await requireAiAccess(userId, 'ai.workout_generation');
    const rl = await rateLimit(`ai-plan:${userId}`, 10, 60 * 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many plans generated. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }
    const body = await parseJsonBody(req, bodySchema);
    const result = await generateWorkoutPlan(userId, { ...body, locale: await getLocale() });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return handleApiError(err);
  }
}
