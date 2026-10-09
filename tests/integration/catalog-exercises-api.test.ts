import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { syncGlobalCatalog } from '@/lib/catalog/sync';

// Global catalog through the exercises API: every user sees the catalog,
// nobody can edit or delete it, and a custom exercise cannot reuse a catalog
// name (names are how imports, backups and the AI refer to exercises).

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as listExercises, POST as createExercise } from '@/app/api/exercises/route';
import {
  DELETE as deleteExercise,
  GET as getExercise,
  PUT as updateExercise,
} from '@/app/api/exercises/[id]/route';

function json(method: string, body?: unknown) {
  return new Request('http://test.local/api/exercises', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const custom = (name: string) => ({
  name,
  muscleGroup: 'OTHER',
  category: 'ISOLATION',
  defaultRestSec: 90,
});

beforeEach(async () => {
  mockUserId.mockReset();
  await syncGlobalCatalog(db);
});

describe('exercises API with the global catalog', () => {
  it('lists the catalog plus the user own exercises, never another user ones', async () => {
    const ana = await db.user.create({ data: { email: 'ana@test.dev', passwordHash: 'x' } });
    const bia = await db.user.create({ data: { email: 'bia@test.dev', passwordHash: 'x' } });
    await db.exercise.create({
      data: {
        userId: bia.id,
        name: 'Bia secret machine',
        muscleGroup: 'OTHER',
        category: 'ISOLATION',
      },
    });
    mockUserId.mockResolvedValue(ana.id);

    const list = (await (await listExercises()).json()) as {
      name: string;
      userId: string | null;
    }[];
    expect(list.length).toBeGreaterThan(150);
    expect(list.some((e) => e.name === 'Barbell bench press' && e.userId === null)).toBe(true);
    expect(list.some((e) => e.name === 'Bia secret machine')).toBe(false);
  });

  it('reads a catalog exercise but refuses to edit or delete it', async () => {
    const ana = await db.user.create({ data: { email: 'ana@test.dev', passwordHash: 'x' } });
    mockUserId.mockResolvedValue(ana.id);
    const bench = await db.exercise.findFirstOrThrow({
      where: { userId: null, name: 'Barbell bench press' },
    });

    expect((await getExercise(json('GET'), params(bench.id))).status).toBe(200);
    expect(
      (await updateExercise(json('PUT', custom('Hijacked bench')), params(bench.id))).status,
    ).toBe(404);
    expect((await deleteExercise(json('DELETE'), params(bench.id))).status).toBe(404);
    await expect(db.exercise.findUnique({ where: { id: bench.id } })).resolves.toMatchObject({
      name: 'Barbell bench press',
    });
  });

  it('refuses a custom exercise named like a catalog one or its pt-BR alias', async () => {
    const ana = await db.user.create({ data: { email: 'ana@test.dev', passwordHash: 'x' } });
    mockUserId.mockResolvedValue(ana.id);

    expect((await createExercise(json('POST', custom('barbell BENCH press')))).status).toBe(409);
    expect((await createExercise(json('POST', custom('Supino reto com barra')))).status).toBe(409);
    const ok = await createExercise(json('POST', custom('My odd machine')));
    expect(ok.status).toBe(201);

    const created = await ok.json();
    // Saving other fields keeps working; renaming onto the catalog does not.
    expect(
      (
        await updateExercise(
          json('PUT', { ...custom('My odd machine'), defaultRestSec: 60 }),
          params(created.id),
        )
      ).status,
    ).toBe(200);
    expect(
      (await updateExercise(json('PUT', custom('Barbell bench press')), params(created.id))).status,
    ).toBe(409);
  });
});
