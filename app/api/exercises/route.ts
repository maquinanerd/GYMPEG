import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exerciseInputSchema } from '@/lib/schemas/exercise';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { usableExerciseWhere } from '@/lib/catalog/access';
import { catalogNameClash } from '@/lib/catalog/resolve';

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const exercises = await db.exercise.findMany({
      where: usableExerciseWhere(userId),
      orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(exercises);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, exerciseInputSchema);
    if (await catalogNameClash(db, data.name)) {
      throw new ApiError(409, 'This exercise already exists in the catalog.');
    }
    const exercise = await db.exercise.create({
      data: { ...data, userId, notes: data.notes ?? null },
    });
    return NextResponse.json(exercise, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
