import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { AMEND_WINDOW_MS } from '@/lib/program-revisions';
import { isEmptyDiff, type ProgramDiff } from '@/lib/program-snapshot';

// Program versions (epic 1.6): every write records the program's structure,
// a burst of manual edits is one version until a session runs with it, and
// restoring brings old content back as a new version, never deleting one.

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as createProgram } from '@/app/api/programs/route';
import { PUT as updateProgram } from '@/app/api/programs/[id]/route';
import { POST as addWorkout } from '@/app/api/programs/[id]/workouts/route';
import { POST as addProgramExercise } from '@/app/api/workouts/[id]/program-exercises/route';
import {
  PUT as updateProgramExercise,
  DELETE as deleteProgramExercise,
} from '@/app/api/program-exercises/[id]/route';
import { PUT as updateWorkout } from '@/app/api/workouts/[id]/route';
import { POST as startSession } from '@/app/api/sessions/route';
import { POST as fromTemplate } from '@/app/api/programs/from-template/route';
import { GET as listRevisions } from '@/app/api/programs/[id]/revisions/route';
import { GET as getRevision } from '@/app/api/programs/[id]/revisions/[revisionId]/route';
import { POST as restoreRevision } from '@/app/api/programs/[id]/revisions/[revisionId]/restore/route';

function jsonReq(method: string, body?: unknown): Request {
  return new Request('http://test.local/api', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const params = <T extends Record<string, string>>(values: T) => ({
  params: Promise.resolve(values),
});

type RevisionRow = {
  id: string;
  version: number;
  source: string;
  restoredFromVersion: number | null;
};

async function versions(programId: string): Promise<RevisionRow[]> {
  const res = await listRevisions(jsonReq('GET'), params({ id: programId }));
  expect(res.status).toBe(200);
  return res.json();
}

const prescription = (exerciseId: string, extra: Record<string, unknown> = {}) => ({
  exerciseId,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetRIR: 2,
  restSec: 120,
  ...extra,
});

// A lifter with a two-exercise program built through the API.
async function seed(email = 'versions@test.dev') {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  mockUserId.mockResolvedValue(user.id);
  const [bench, row] = await Promise.all(
    ['Versioned bench', 'Versioned row'].map((name) =>
      db.exercise.create({
        data: { userId: user.id, name, muscleGroup: 'CHEST', category: 'COMPOUND' },
      }),
    ),
  );
  const program = await (
    await createProgram(jsonReq('POST', { name: 'Block A', phase: 'Base' }))
  ).json();
  const workout = await (
    await addWorkout(jsonReq('POST', { name: 'Upper' }), params({ id: program.id }))
  ).json();
  const benchRow = await (
    await addProgramExercise(jsonReq('POST', prescription(bench!.id)), params({ id: workout.id }))
  ).json();
  const rowRow = await (
    await addProgramExercise(jsonReq('POST', prescription(row!.id)), params({ id: workout.id }))
  ).json();
  return { user, bench: bench!, row: row!, program, workout, benchRow, rowRow };
}

// Pushes the latest version out of the edit-coalescing window.
async function ageLatestVersion(programId: string) {
  const latest = await db.programRevision.findFirstOrThrow({
    where: { programId },
    orderBy: { version: 'desc' },
  });
  await db.$executeRaw`UPDATE "ProgramRevision" SET "updatedAt" = ${new Date(Date.now() - AMEND_WINDOW_MS - 1000)} WHERE id = ${latest.id}`;
}

beforeEach(() => mockUserId.mockReset());

describe('recording program versions', () => {
  it('records the creation and coalesces a burst of edits into one version', async () => {
    const { program } = await seed();

    const list = await versions(program.id);

    expect(list.map((row) => [row.version, row.source])).toEqual([
      [2, 'USER'],
      [1, 'CREATED'],
    ]);
    const v2 = await db.programRevision.findFirstOrThrow({
      where: { programId: program.id, version: 2 },
    });
    const snapshot = v2.snapshot as { workouts: Array<{ exercises: unknown[] }> };
    expect(snapshot.workouts[0]!.exercises).toHaveLength(2);
  });

  it('records nothing when a write changes nothing', async () => {
    const { program } = await seed();
    await ageLatestVersion(program.id);

    await updateProgram(
      jsonReq('PUT', { name: 'Block A', phase: 'Base' }),
      params({ id: program.id }),
    );

    expect(await versions(program.id)).toHaveLength(2);
  });

  it('starts a new version after the edit window', async () => {
    const { program, workout } = await seed();
    await ageLatestVersion(program.id);

    await updateWorkout(jsonReq('PUT', { name: 'Upper A' }), params({ id: workout.id }));

    expect((await versions(program.id))[0]).toMatchObject({ version: 3, source: 'USER' });
  });

  it('freezes the version a session ran: the next edit starts a new one', async () => {
    const { program, workout, benchRow, bench } = await seed();

    const session = await (await startSession(jsonReq('POST', { workoutId: workout.id }))).json();
    await updateProgramExercise(
      jsonReq('PUT', prescription(bench.id, { targetSets: 5 })),
      params({ id: benchRow.id }),
    );

    const list = await versions(program.id);
    expect(list.map((row) => row.version)).toEqual([3, 2, 1]);
    const ran = await db.programRevision.findFirstOrThrow({
      where: { programId: program.id, version: 2 },
    });
    expect(session.programRevisionId).toBe(ran.id);
    const ranSnapshot = ran.snapshot as {
      workouts: Array<{ exercises: Array<{ targetSets: number }> }>;
    };
    expect(ranSnapshot.workouts[0]!.exercises[0]!.targetSets).toBe(3);
  });

  it('labels the first version of a program built from a template', async () => {
    const user = await db.user.create({ data: { email: 'template@test.dev', passwordHash: 'x' } });
    mockUserId.mockResolvedValue(user.id);

    const { id } = await (
      await fromTemplate(
        jsonReq('POST', {
          name: 'Starter',
          phase: 'Base',
          workouts: [
            {
              name: 'Day A',
              exercises: [
                {
                  name: 'Template squat',
                  muscleGroup: 'QUADS',
                  category: 'COMPOUND',
                  targetSets: 3,
                  targetRepsMin: 5,
                  targetRepsMax: 8,
                  targetRIR: 2,
                  restSec: 180,
                },
              ],
            },
          ],
        }),
      )
    ).json();

    expect((await versions(id)).map((row) => row.source)).toEqual(['TEMPLATE']);
  });
});

describe('comparing and restoring versions', () => {
  it('shows what a version changed and what restoring it would change', async () => {
    const { program, workout, bench, benchRow } = await seed();
    await startSession(jsonReq('POST', { workoutId: workout.id }));
    await updateProgramExercise(
      jsonReq('PUT', prescription(bench.id, { targetSets: 5 })),
      params({ id: benchRow.id }),
    );
    const v2 = (await versions(program.id)).find((row) => row.version === 2)!;

    const detail = await (
      await getRevision(jsonReq('GET'), params({ id: program.id, revisionId: v2.id }))
    ).json();

    const fromPrevious = detail.changesFromPrevious as ProgramDiff;
    expect(fromPrevious.workoutsAdded).toEqual([
      { name: 'Upper', exercises: ['Versioned bench', 'Versioned row'] },
    ]);
    const toRestore = detail.changesToRestore as ProgramDiff;
    expect(toRestore.workoutsChanged[0]!.exercisesChanged).toEqual([
      { name: 'Versioned bench', fields: [{ field: 'targetSets', from: 5, to: 3 }] },
    ]);
  });

  it('restores an old version as a new one, keeping the rows sessions point to', async () => {
    const { program, workout, bench, benchRow, rowRow } = await seed();
    const session = await (await startSession(jsonReq('POST', { workoutId: workout.id }))).json();
    await updateProgramExercise(
      jsonReq('PUT', prescription(bench.id, { targetSets: 5 })),
      params({ id: benchRow.id }),
    );
    await deleteProgramExercise(jsonReq('DELETE'), params({ id: rowRow.id }));
    await updateWorkout(jsonReq('PUT', { name: 'Upper heavy' }), params({ id: workout.id }));
    const v2 = (await versions(program.id)).find((row) => row.version === 2)!;

    const res = await restoreRevision(
      jsonReq('POST'),
      params({ id: program.id, revisionId: v2.id }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ version: 4, restoredFromVersion: 2 });
    const restored = await db.workout.findUniqueOrThrow({
      where: { id: workout.id },
      include: { exercises: { orderBy: { order: 'asc' }, include: { exercise: true } } },
    });
    expect(restored.name).toBe('Upper');
    expect(restored.exercises.map((pe) => [pe.exercise.name, pe.targetSets])).toEqual([
      ['Versioned bench', 3],
      ['Versioned row', 3],
    ]);
    // The session still points to its workout and its version.
    expect(await db.session.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({
      workoutId: workout.id,
      programRevisionId: v2.id,
    });
    // Nothing was deleted from the history, and the program now equals v4.
    expect((await versions(program.id)).map((row) => row.version)).toEqual([4, 3, 2, 1]);
    const v4 = (await versions(program.id))[0]!;
    const detail = await (
      await getRevision(jsonReq('GET'), params({ id: program.id, revisionId: v4.id }))
    ).json();
    expect(isEmptyDiff(detail.changesToRestore)).toBe(true);
  });

  it('refuses to restore a version whose exercise no longer exists, then matches it by name', async () => {
    const { user, program, workout, row, rowRow } = await seed();
    await startSession(jsonReq('POST', { workoutId: workout.id }));
    await deleteProgramExercise(jsonReq('DELETE'), params({ id: rowRow.id }));
    await db.exercise.delete({ where: { id: row.id } });
    const v2 = (await versions(program.id)).find((item) => item.version === 2)!;

    const refused = await restoreRevision(
      jsonReq('POST'),
      params({ id: program.id, revisionId: v2.id }),
    );
    expect(refused.status).toBe(409);
    expect((await refused.json()).missingExercises).toEqual(['Versioned row']);
    expect(await versions(program.id)).toHaveLength(3);

    const recreated = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Versioned row',
        muscleGroup: 'BACK_THICKNESS',
        category: 'COMPOUND',
      },
    });
    const restored = await restoreRevision(
      jsonReq('POST'),
      params({ id: program.id, revisionId: v2.id }),
    );
    expect(restored.status).toBe(201);
    const exercises = await db.programExercise.findMany({ where: { workoutId: workout.id } });
    expect(exercises.map((pe) => pe.exerciseId)).toContain(recreated.id);
  });

  it("keeps another account's versions out of reach", async () => {
    const owner = await seed('owner-versions@test.dev');
    const v1 = (await versions(owner.program.id)).find((row) => row.version === 1)!;
    const intruder = await db.user.create({
      data: { email: 'intruder-versions@test.dev', passwordHash: 'x' },
    });
    mockUserId.mockResolvedValue(intruder.id);

    const list = await listRevisions(jsonReq('GET'), params({ id: owner.program.id }));
    const detail = await getRevision(
      jsonReq('GET'),
      params({ id: owner.program.id, revisionId: v1.id }),
    );
    const restore = await restoreRevision(
      jsonReq('POST'),
      params({ id: owner.program.id, revisionId: v1.id }),
    );

    expect([list.status, detail.status, restore.status]).toEqual([404, 404, 404]);
    mockUserId.mockResolvedValue(owner.user.id);
    expect(await versions(owner.program.id)).toHaveLength(2);
  });
});
