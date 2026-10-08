import type { PrismaClient } from '@/prisma/generated/client';
import { EXERCISE_CATALOG } from '@/lib/exercise-catalog';
import { findUsableExerciseByName } from '@/lib/catalog/resolve';
import { syncGlobalCatalog } from '@/lib/catalog/sync';

// Name -> global exercise id for the starter catalog names (lib/exercise-catalog),
// used by the demo seed to wire a starter program. Accounts no longer get a
// private copy of the catalog: everyone shares the global one.
export async function starterCatalogMap(
  prisma: PrismaClient,
  userId: string,
): Promise<Map<string, string>> {
  await syncGlobalCatalog(prisma);
  const map = new Map<string, string>();
  for (const { name } of EXERCISE_CATALOG) {
    const exercise = await findUsableExerciseByName(prisma, userId, name);
    if (!exercise) throw new Error(`Starter exercise missing from the catalog: ${name}`);
    map.set(name, exercise.id);
  }
  return map;
}
