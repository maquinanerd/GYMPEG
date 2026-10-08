import { describe, expect, it, vi } from 'vitest';
import { ensureUsableExercise, findUsableExerciseByName } from './resolve';
import { exerciseFixture } from '@/tests/fixtures/exercise';

function fakeDb(options: {
  own?: ReturnType<typeof exerciseFixture> | null;
  global?: ReturnType<typeof exerciseFixture> | null;
  alias?: ReturnType<typeof exerciseFixture> | null;
}) {
  const findFirst = vi.fn(async (args: { where: { userId: string | null } }) =>
    args.where.userId === null ? (options.global ?? null) : (options.own ?? null),
  );
  const aliasFindFirst = vi.fn(async (_args?: unknown) =>
    options.alias ? { exercise: options.alias } : null,
  );
  const create = vi.fn(async (args: { data: Record<string, unknown> }) =>
    exerciseFixture({ id: 'new', ...(args.data as object) }),
  );
  return {
    db: { exercise: { findFirst, create }, exerciseAlias: { findFirst: aliasFindFirst } },
    findFirst,
    aliasFindFirst,
    create,
  };
}

describe('findUsableExerciseByName', () => {
  it('prefers the user own exercise, then the global name, then an alias', async () => {
    const own = exerciseFixture({ id: 'own', userId: 'u1', name: 'Supino' });
    const global = exerciseFixture({ id: 'global', userId: null, name: 'Barbell bench press' });
    const viaAlias = exerciseFixture({ id: 'alias', userId: null });

    expect(
      (await findUsableExerciseByName(fakeDb({ own, global }).db as never, 'u1', 'supino'))?.id,
    ).toBe('own');
    expect((await findUsableExerciseByName(fakeDb({ global }).db as never, 'u1', 'x'))?.id).toBe(
      'global',
    );
    expect(
      (await findUsableExerciseByName(fakeDb({ alias: viaAlias }).db as never, 'u1', 'Pulley'))?.id,
    ).toBe('alias');
  });

  it('matches names case-insensitively and aliases accent-insensitively', async () => {
    const { db, findFirst, aliasFindFirst } = fakeDb({});
    await findUsableExerciseByName(db as never, 'u1', '  Elevação Pélvica  ');
    expect(findFirst.mock.calls[0]![0]).toMatchObject({
      where: { userId: 'u1', name: { equals: 'Elevação Pélvica', mode: 'insensitive' } },
    });
    expect(aliasFindFirst.mock.calls[0]![0]).toMatchObject({
      where: { normalized: 'elevacao pelvica', exercise: { userId: null } },
    });
  });

  it('returns null for blank names without querying', async () => {
    const { db, findFirst } = fakeDb({});
    await expect(findUsableExerciseByName(db as never, 'u1', '   ')).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe('ensureUsableExercise', () => {
  it('reuses a catalog exercise instead of creating a copy', async () => {
    const global = exerciseFixture({ id: 'global', userId: null });
    const { db, create } = fakeDb({ global });
    const result = await ensureUsableExercise(db as never, 'u1', {
      name: 'Barbell bench press',
      muscleGroup: 'CHEST',
      category: 'COMPOUND',
    });
    expect(result).toMatchObject({ created: false, exercise: { id: 'global' } });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a private custom exercise for an unknown name', async () => {
    const { db, create } = fakeDb({});
    const result = await ensureUsableExercise(db as never, 'u1', {
      name: '  Brand new cable thing ',
      muscleGroup: 'SHOULDERS_LATERAL',
      category: 'ISOLATION',
    });
    expect(result.created).toBe(true);
    expect(create.mock.calls[0]![0].data).toMatchObject({
      userId: 'u1',
      name: 'Brand new cable thing',
      source: 'user',
    });
  });
});
