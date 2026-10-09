// Program versions (ProgramRevision): every write path that changes a
// program's structure calls recordProgramRevision() once its change is
// committed. A version is never destroyed; restoring one writes a new
// version with the old content (tests/integration/program-revision-coverage
// keeps every write path honest).

import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/api';
import { usableExerciseWhere } from '@/lib/catalog/access';
import { findUsableExerciseByName } from '@/lib/catalog/resolve';
import { Prisma } from '@/prisma/generated/client';
import type { ProgramRevision, ProgramRevisionSource } from '@/lib/prisma-client';
import {
  buildProgramSnapshot,
  diffProgramSnapshots,
  programSnapshotSchema,
  snapshotContent,
  type ProgramDiff,
  type ProgramSnapshot,
} from '@/lib/program-snapshot';

// Manual edits arrive one field at a time (add an exercise, change its sets,
// rename the day...). Within this window they amend the latest version
// instead of piling up versions, as long as no session ran with it.
export const AMEND_WINDOW_MS = 10 * 60 * 1000;
const AMENDABLE_SOURCES: ReadonlySet<ProgramRevisionSource> = new Set(['USER', 'MCP']);

const snapshotInclude = {
  workouts: {
    orderBy: { order: 'asc' },
    include: {
      exercises: {
        orderBy: { order: 'asc' },
        include: { exercise: { select: { name: true } } },
      },
    },
  },
} as const;

export function hashSnapshot(snapshot: ProgramSnapshot): string {
  return createHash('sha256').update(snapshotContent(snapshot)).digest('hex');
}

export async function loadProgramSnapshot(programId: string): Promise<ProgramSnapshot | null> {
  const program = await db.program.findUnique({
    where: { id: programId },
    include: snapshotInclude,
  });
  return program ? buildProgramSnapshot(program) : null;
}

export interface RecordOptions {
  source: ProgramRevisionSource;
  summary?: string | null;
  restoredFromVersion?: number;
  now?: Date;
}

// Records the program's current structure as a version, unless it equals the
// latest one. Runs after the change is committed and never fails the write
// it follows: a version missed here is captured by the next call, since a
// version is a snapshot of the whole program, not a list of edits.
export async function recordProgramRevision(
  programId: string,
  options: RecordOptions,
): Promise<ProgramRevision | null> {
  try {
    return await recordWithRetry(programId, options);
  } catch (err) {
    console.error('[program-revisions] could not record a version:', err);
    return null;
  }
}

async function recordWithRetry(programId: string, options: RecordOptions) {
  // Two concurrent writes may both claim the next version number; the loser
  // retries on top of the winner.
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await recordOnce(programId, options);
    } catch (err) {
      const conflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!conflict || attempt >= 2) throw err;
    }
  }
}

async function recordOnce(
  programId: string,
  { source, summary = null, restoredFromVersion, now = new Date() }: RecordOptions,
): Promise<ProgramRevision | null> {
  const snapshot = await loadProgramSnapshot(programId);
  if (!snapshot) return null;
  const contentHash = hashSnapshot(snapshot);

  const latest = await db.programRevision.findFirst({
    where: { programId },
    orderBy: { version: 'desc' },
    include: { _count: { select: { sessions: true } } },
  });
  if (latest && latest.contentHash === contentHash && source !== 'RESTORE') {
    return latest;
  }
  if (
    latest &&
    latest.source === source &&
    AMENDABLE_SOURCES.has(source) &&
    latest._count.sessions === 0 &&
    now.getTime() - latest.updatedAt.getTime() < AMEND_WINDOW_MS
  ) {
    return db.programRevision.update({
      where: { id: latest.id },
      data: { snapshot: snapshot as Prisma.InputJsonValue, contentHash },
    });
  }
  return db.programRevision.create({
    data: {
      programId,
      version: (latest?.version ?? 0) + 1,
      source,
      summary,
      restoredFromVersion: restoredFromVersion ?? null,
      snapshot: snapshot as Prisma.InputJsonValue,
      contentHash,
    },
  });
}

// The version matching the program as it is now, recorded when the program
// changed through a path that did not record one (or before versions
// existed). A session started now ran this version.
export async function currentProgramRevisionId(programId: string): Promise<string | null> {
  return (await recordProgramRevision(programId, { source: 'SYSTEM' }))?.id ?? null;
}

// Startup: programs created before versions existed get their baseline.
export async function backfillProgramRevisions(): Promise<number> {
  const programs = await db.program.findMany({
    where: { revisions: { none: {} } },
    select: { id: true },
  });
  for (const program of programs) {
    await recordProgramRevision(program.id, { source: 'SYSTEM' });
  }
  return programs.length;
}

// ---------------------------------------------------------------------------
// Reading and restoring (scoped to the program's owner)
// ---------------------------------------------------------------------------

async function requireOwnedProgram(userId: string, programId: string) {
  const program = await db.program.findFirst({
    where: { id: programId, userId },
    select: { id: true },
  });
  if (!program) throw new ApiError(404, 'Program not found.');
}

export async function listProgramRevisions(userId: string, programId: string) {
  await requireOwnedProgram(userId, programId);
  const revisions = await db.programRevision.findMany({
    where: { programId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      source: true,
      summary: true,
      restoredFromVersion: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { sessions: true } },
    },
  });
  return revisions.map(({ _count, ...revision }) => ({
    ...revision,
    sessionCount: _count.sessions,
  }));
}

export interface RevisionDetail {
  revision: {
    id: string;
    version: number;
    source: ProgramRevisionSource;
    summary: string | null;
    restoredFromVersion: number | null;
    createdAt: Date;
  };
  snapshot: ProgramSnapshot;
  // What this version changed compared with the one before it.
  changesFromPrevious: ProgramDiff | null;
  // What restoring it would change in the program as it is now.
  changesToRestore: ProgramDiff;
}

export async function getProgramRevision(
  userId: string,
  programId: string,
  revisionId: string,
): Promise<RevisionDetail> {
  await requireOwnedProgram(userId, programId);
  const revision = await db.programRevision.findFirst({ where: { id: revisionId, programId } });
  if (!revision) throw new ApiError(404, 'Version not found.');
  const snapshot = programSnapshotSchema.parse(revision.snapshot);

  const previous = await db.programRevision.findFirst({
    where: { programId, version: { lt: revision.version } },
    orderBy: { version: 'desc' },
  });
  const current = await loadProgramSnapshot(programId);

  return {
    revision: {
      id: revision.id,
      version: revision.version,
      source: revision.source,
      summary: revision.summary,
      restoredFromVersion: revision.restoredFromVersion,
      createdAt: revision.createdAt,
    },
    snapshot,
    changesFromPrevious: previous
      ? diffProgramSnapshots(programSnapshotSchema.parse(previous.snapshot), snapshot)
      : null,
    changesToRestore: diffProgramSnapshots(current!, snapshot),
  };
}

// Brings a version's content back as a new version. Rows still present keep
// their ids (sessions point to workouts), missing ones are re-created, extra
// ones removed. An exercise that no longer exists is matched by name (a
// merge into the catalog); when none matches, nothing changes (409).
export async function restoreProgramRevision(
  userId: string,
  programId: string,
  revisionId: string,
): Promise<ProgramRevision> {
  await requireOwnedProgram(userId, programId);
  const revision = await db.programRevision.findFirst({ where: { id: revisionId, programId } });
  if (!revision) throw new ApiError(404, 'Version not found.');
  const snapshot = programSnapshotSchema.parse(revision.snapshot);
  const exerciseIds = await resolveSnapshotExercises(userId, snapshot);

  await db.$transaction(async (tx) => {
    await tx.program.update({
      where: { id: programId, userId },
      data: {
        name: snapshot.name,
        description: snapshot.description,
        phase: snapshot.phase,
        scheduleMode: snapshot.scheduleMode,
      },
    });
    const current = await tx.workout.findMany({
      where: { programId },
      select: { id: true, exercises: { select: { id: true } } },
    });
    const currentWorkoutIds = new Set(current.map((workout) => workout.id));
    const currentExerciseIds = new Set(
      current.flatMap((workout) => workout.exercises.map((pe) => pe.id)),
    );

    await tx.workout.deleteMany({
      where: { programId, id: { notIn: snapshot.workouts.map((workout) => workout.id) } },
    });

    for (const workout of snapshot.workouts) {
      const data = { name: workout.name, dayOfWeek: workout.dayOfWeek, order: workout.order };
      const workoutId = currentWorkoutIds.has(workout.id)
        ? (await tx.workout.update({ where: { id: workout.id }, data })).id
        : (await tx.workout.create({ data: { ...data, programId } })).id;

      await tx.programExercise.deleteMany({
        where: { workoutId, id: { notIn: workout.exercises.map((pe) => pe.id) } },
      });
      for (const pe of workout.exercises) {
        const prescription = {
          workoutId,
          exerciseId: exerciseIds.get(pe.exerciseId)!,
          order: pe.order,
          targetSets: pe.targetSets,
          targetRepsMin: pe.targetRepsMin,
          targetRepsMax: pe.targetRepsMax,
          targetRIR: pe.targetRIR,
          restSec: pe.restSec,
          tempo: pe.tempo,
          notes: pe.notes,
          supersetGroup: pe.supersetGroup,
          autoregulationMode: pe.autoregulationMode,
          fatigueRate: pe.fatigueRate,
          loadAdjustmentPct: pe.loadAdjustmentPct,
        };
        if (currentExerciseIds.has(pe.id)) {
          await tx.programExercise.update({ where: { id: pe.id }, data: prescription });
        } else {
          await tx.programExercise.create({ data: prescription });
        }
      }
    }
  });

  const restored = await recordProgramRevision(programId, {
    source: 'RESTORE',
    restoredFromVersion: revision.version,
  });
  if (!restored) throw new Error('The restored version could not be recorded.');
  return restored;
}

// Maps each exercise id of the snapshot to one the user can still use.
async function resolveSnapshotExercises(
  userId: string,
  snapshot: ProgramSnapshot,
): Promise<Map<string, string>> {
  const wanted = new Map<string, string>();
  for (const workout of snapshot.workouts) {
    for (const pe of workout.exercises) wanted.set(pe.exerciseId, pe.exerciseName);
  }
  const usable = await db.exercise.findMany({
    where: { id: { in: [...wanted.keys()] }, ...usableExerciseWhere(userId) },
    select: { id: true },
  });
  const resolved = new Map(usable.map((exercise) => [exercise.id, exercise.id]));
  const missing: string[] = [];
  for (const [id, name] of wanted) {
    if (resolved.has(id)) continue;
    const byName = await findUsableExerciseByName(db, userId, name);
    if (byName) resolved.set(id, byName.id);
    else missing.push(name);
  }
  if (missing.length > 0) throw new MissingExercisesError(missing);
  return resolved;
}

// A version names exercises that no longer exist (409). The names travel in
// the response so the screen can say which ones, in the user's language.
export class MissingExercisesError extends ApiError {
  constructor(readonly names: string[]) {
    super(409, `Exercises no longer available: ${names.join(', ')}.`);
  }
}
