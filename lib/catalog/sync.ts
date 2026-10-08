import { createHash } from 'node:crypto';
import exercisesJson from '@/data/catalog/exercises.json';
import musclesJson from '@/data/catalog/muscles.json';
import type { PrismaClient } from '@/prisma/generated/client';
import type { MovementPattern, Prisma } from '@/lib/prisma-client';
import {
  catalogFileSchema,
  catalogMuscleSchema,
  normalizeExerciseText,
  type CatalogExerciseEntry,
  type CatalogMuscle,
} from '@/lib/catalog/catalog-schema';

// Writes the curated catalog (data/catalog/*.json) into the database as the
// global exercises (userId null), then folds the old per-user copies of those
// exercises into them. Runs at server start (instrumentation.ts) and is a
// no-op when the files did not change since the last sync (content hash).

const SYNC_ID = 'exercises';

export interface LoadedCatalog {
  version: number;
  hash: string;
  exercises: CatalogExerciseEntry[];
  muscles: CatalogMuscle[];
}

export function loadCatalog(): LoadedCatalog {
  const file = catalogFileSchema.parse(exercisesJson);
  const muscles = catalogMuscleSchema.array().parse(musclesJson);
  const muscleSlugs = new Set(muscles.map((m) => m.slug));
  const slugs = new Set<string>();
  for (const exercise of file.exercises) {
    if (slugs.has(exercise.slug)) throw new Error(`Duplicate catalog slug: ${exercise.slug}`);
    slugs.add(exercise.slug);
    for (const slug of [...exercise.muscles.primary, ...exercise.muscles.secondary]) {
      if (!muscleSlugs.has(slug)) {
        throw new Error(`Catalog exercise ${exercise.slug} references unknown muscle ${slug}`);
      }
    }
  }
  const hash = createHash('sha256')
    .update(JSON.stringify(exercisesJson))
    .update(JSON.stringify(musclesJson))
    .digest('hex');
  return { version: file.version, hash, exercises: file.exercises, muscles };
}

function aliasRows(exercise: CatalogExerciseEntry) {
  const rows = new Map<
    string,
    { alias: string; normalized: string; locale: string; isLegacy: boolean }
  >();
  const add = (alias: string, locale: string, isLegacy: boolean) => {
    const normalized = normalizeExerciseText(alias);
    if (!normalized) return;
    const existing = rows.get(normalized);
    // A legacy name wins: it is the strongest merge signal.
    if (!existing || (isLegacy && !existing.isLegacy)) {
      rows.set(normalized, { alias, normalized, locale, isLegacy });
    }
  };
  add(exercise.name, 'en', false);
  add(exercise.namePtBr, 'pt-BR', false);
  for (const alias of exercise.aliases.pt) add(alias, 'pt-BR', false);
  for (const alias of exercise.aliases.en) add(alias, 'en', false);
  for (const legacy of exercise.legacyNames) add(legacy, 'en', true);
  return [...rows.values()];
}

function exerciseData(exercise: CatalogExerciseEntry) {
  return {
    userId: null,
    name: exercise.name,
    namePtBr: exercise.namePtBr,
    muscleGroup: exercise.muscleGroup,
    category: exercise.category,
    movementPattern: exercise.movementPattern.toUpperCase() as MovementPattern,
    laterality: exercise.laterality,
    level: exercise.level,
    equipmentTags: exercise.equipment,
    instructionsPtBr: exercise.instructionsPtBr,
    commonMistakesPtBr: exercise.commonMistakesPtBr,
    defaultRestSec: exercise.defaultRestSec,
    usesBodyweight: exercise.usesBodyweight,
    equipmentType: exercise.equipmentType,
    source: exercise.source,
    sourceRef: exercise.sourceRef,
    sourceLicense: exercise.sourceLicense,
    reviewStatus: exercise.reviewStatus,
    active: true,
  } satisfies Prisma.ExerciseUncheckedCreateInput;
}

export interface CatalogSyncReport {
  skipped: boolean;
  upserted: number;
  retired: number;
  merged: number;
}

export async function syncGlobalCatalog(
  db: PrismaClient,
  options: { force?: boolean } = {},
): Promise<CatalogSyncReport> {
  const catalog = loadCatalog();
  const last = await db.catalogSync.findUnique({ where: { id: SYNC_ID } });
  if (!options.force && last?.hash === catalog.hash) {
    return { skipped: true, upserted: 0, retired: 0, merged: 0 };
  }

  const { upserted, retired } = await db.$transaction(
    async (tx) => {
      const muscleIds = new Map<string, string>();
      for (const muscle of catalog.muscles) {
        const row = await tx.muscle.upsert({
          where: { slug: muscle.slug },
          create: muscle,
          update: muscle,
          select: { id: true },
        });
        muscleIds.set(muscle.slug, row.id);
      }

      for (const entry of catalog.exercises) {
        const data = exerciseData(entry);
        const row = await tx.exercise.upsert({
          where: { slug: entry.slug },
          create: { ...data, slug: entry.slug },
          update: data,
          select: { id: true },
        });
        await tx.exerciseMuscle.deleteMany({ where: { exerciseId: row.id } });
        const muscleRows = [
          ...entry.muscles.primary.map((slug) => ({ slug, role: 'PRIMARY' as const })),
          ...entry.muscles.secondary
            .filter((slug) => !entry.muscles.primary.includes(slug))
            .map((slug) => ({ slug, role: 'SECONDARY' as const })),
        ];
        await tx.exerciseMuscle.createMany({
          data: muscleRows.map((m) => ({
            exerciseId: row.id,
            muscleId: muscleIds.get(m.slug)!,
            role: m.role,
          })),
        });
        await tx.exerciseAlias.deleteMany({ where: { exerciseId: row.id } });
        await tx.exerciseAlias.createMany({
          data: aliasRows(entry).map((alias) => ({ ...alias, exerciseId: row.id })),
        });
      }

      // Catalog rows dropped from the file are retired, never deleted: sets
      // and programs keep pointing at them.
      const retiredRows = await tx.exercise.updateMany({
        where: {
          userId: null,
          slug: { notIn: catalog.exercises.map((e) => e.slug) },
          active: true,
        },
        data: { active: false },
      });

      await tx.catalogSync.upsert({
        where: { id: SYNC_ID },
        create: { id: SYNC_ID, version: catalog.version, hash: catalog.hash },
        update: { version: catalog.version, hash: catalog.hash, syncedAt: new Date() },
      });
      return { upserted: catalog.exercises.length, retired: retiredRows.count };
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  const merged = await mergeLegacyUserExercises(db);
  return { skipped: false, upserted, retired, merged };
}

// Before the global catalog, every account got its own copy of the starter
// catalog (and templates created more copies by name). A user exercise whose
// name is a catalog exercise's name or legacy name is folded into the global
// one: its sets, program lines, goals and gym links are re-pointed, then the
// copy is deleted. Custom exercises with other names stay as they are.
export async function mergeLegacyUserExercises(db: PrismaClient): Promise<number> {
  const globals = await db.exercise.findMany({
    where: { userId: null, active: true },
    select: {
      id: true,
      name: true,
      aliases: { where: { isLegacy: true }, select: { normalized: true } },
    },
  });
  const globalByName = new Map<string, string>();
  for (const g of globals) {
    globalByName.set(normalizeExerciseText(g.name), g.id);
    for (const alias of g.aliases) globalByName.set(alias.normalized, g.id);
  }

  const userExercises = await db.exercise.findMany({
    where: { userId: { not: null } },
    select: { id: true, userId: true, name: true },
  });
  let merged = 0;
  for (const own of userExercises) {
    const target = globalByName.get(normalizeExerciseText(own.name));
    if (!target || !own.userId) continue;
    await mergeExerciseInto(db, own.id, target, own.userId);
    merged += 1;
  }
  return merged;
}

async function mergeExerciseInto(
  db: PrismaClient,
  fromId: string,
  toId: string,
  userId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.set.updateMany({ where: { exerciseId: fromId }, data: { exerciseId: toId } });
    await tx.programExercise.updateMany({
      where: { exerciseId: fromId },
      data: { exerciseId: toId },
    });
    await tx.mcpHistoricalEquipmentBackfillAudit.updateMany({
      where: { exerciseId: fromId },
      data: { exerciseId: toId },
    });

    // One goal per (user, exercise): keep the one already on the target.
    const goal = await tx.exerciseGoal.findUnique({
      where: { userId_exerciseId: { userId, exerciseId: fromId } },
    });
    if (goal) {
      const clash = await tx.exerciseGoal.findUnique({
        where: { userId_exerciseId: { userId, exerciseId: toId } },
      });
      if (clash) await tx.exerciseGoal.delete({ where: { id: goal.id } });
      else await tx.exerciseGoal.update({ where: { id: goal.id }, data: { exerciseId: toId } });
    }

    // One config per (gym, exercise).
    const configs = await tx.gymExerciseConfig.findMany({ where: { exerciseId: fromId } });
    for (const config of configs) {
      const clash = await tx.gymExerciseConfig.findUnique({
        where: { gymId_exerciseId: { gymId: config.gymId, exerciseId: toId } },
      });
      if (clash) await tx.gymExerciseConfig.delete({ where: { id: config.id } });
      else
        await tx.gymExerciseConfig.update({ where: { id: config.id }, data: { exerciseId: toId } });
    }

    // Equipment links are keyed by (equipment, exercise): recreate on the target.
    const links = await tx.gymEquipmentExercise.findMany({ where: { exerciseId: fromId } });
    for (const link of links) {
      await tx.gymEquipmentExercise.upsert({
        where: { equipmentId_exerciseId: { equipmentId: link.equipmentId, exerciseId: toId } },
        create: { equipmentId: link.equipmentId, exerciseId: toId },
        update: {},
      });
    }
    await tx.gymEquipmentExercise.deleteMany({ where: { exerciseId: fromId } });

    await tx.exercise.delete({ where: { id: fromId } });
  });
}
