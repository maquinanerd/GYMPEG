import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { requireAiAccess } from '@/lib/ai/gate';
import { saveWorkoutPlan } from '@/lib/ai/planner';
import { aiWorkoutPlanSchema } from '@/lib/ai/workout-plan';

const bodySchema = z.object({
  plan: aiWorkoutPlanSchema,
  activate: z.boolean().default(false),
});

// POST /api/ai/workout-plan/confirm: the lifter accepted the preview. The plan
// is validated again (it may have been edited) and saved as a program with
// its first version; with activate it becomes the active program.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    await requireAiAccess(userId, 'ai.workout_generation');
    const { plan, activate } = await parseJsonBody(req, bodySchema);
    const programId = await saveWorkoutPlan(userId, plan);
    if (activate) {
      await db.$transaction([
        db.program.updateMany({
          where: { userId, isActive: true, id: { not: programId } },
          data: { isActive: false },
        }),
        db.program.update({ where: { id: programId, userId }, data: { isActive: true } }),
      ]);
    }
    return NextResponse.json({ id: programId }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
