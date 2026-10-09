// History filters (epic 1.8): program, gym, exercise and muscle group, on top
// of the month the calendar shows. One parser for the page, the calendar links
// and the CSV export, so the three always agree.

import type { MuscleGroup, Prisma } from '@/lib/prisma-client';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';

export interface HistoryFilterValues {
  programId?: string;
  gymId?: string;
  exerciseId?: string;
  muscle?: MuscleGroup;
}

export const HISTORY_FILTER_KEYS = ['programId', 'gymId', 'exerciseId', 'muscle'] as const;
export type HistoryFilterKey = (typeof HISTORY_FILTER_KEYS)[number];

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MUSCLES = new Set(Object.keys(muscleGroupMessageKeys));

// Unknown or malformed values are dropped, never passed to the database.
export function parseHistoryFilters(
  params: Partial<Record<HistoryFilterKey, string | null | undefined>>,
): HistoryFilterValues {
  const filters: HistoryFilterValues = {};
  if (params.programId && ID.test(params.programId)) filters.programId = params.programId;
  if (params.gymId && ID.test(params.gymId)) filters.gymId = params.gymId;
  if (params.exerciseId && ID.test(params.exerciseId)) filters.exerciseId = params.exerciseId;
  if (params.muscle && MUSCLES.has(params.muscle)) filters.muscle = params.muscle as MuscleGroup;
  return filters;
}

export function hasHistoryFilters(filters: HistoryFilterValues): boolean {
  return HISTORY_FILTER_KEYS.some((key) => filters[key] != null);
}

// Writes the active filters into `params` (and removes the inactive ones).
export function setHistoryFilterParams(params: URLSearchParams, filters: HistoryFilterValues) {
  for (const key of HISTORY_FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params;
}

// Finished sessions of the user matching the filters. An exercise or muscle
// filter keeps the sessions with at least one working set of it.
export function historySessionWhere(
  userId: string,
  filters: HistoryFilterValues,
  startedAt?: Prisma.DateTimeFilter,
): Prisma.SessionWhereInput {
  const where: Prisma.SessionWhereInput = {
    userId,
    finishedAt: { not: null },
    ...(startedAt ? { startedAt } : {}),
  };
  if (filters.programId) where.programId = filters.programId;
  if (filters.gymId) where.gymId = filters.gymId;
  if (filters.exerciseId || filters.muscle) {
    where.sets = {
      some: {
        isWarmup: false,
        ...(filters.exerciseId ? { exerciseId: filters.exerciseId } : {}),
        ...(filters.muscle ? { exercise: { muscleGroup: filters.muscle } } : {}),
      },
    };
  }
  return where;
}
