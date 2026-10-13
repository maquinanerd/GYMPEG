// Muscle heat map (issue #299): pure mapping from the weekly working-set
// counts (lib/stats.ts) to the body-silhouette regions the progress page
// paints. Display-only; never influences progression or coach logic.

import type { MuscleGroup } from '@/lib/prisma-client';
import { classifyWeeklySets, resolveVolumeBand, type VolumeBand } from '@/lib/stats';

export type BodyView = 'front' | 'back';

// How hot a region paints: untouched, below MEV, inside the MEV/MRV band, or
// above MRV. Mirrors classifyWeeklySets, with zero sets split out so an
// untrained muscle reads as absent rather than merely low.
export type HeatLevel = 'none' | 'low' | 'optimal' | 'high';

interface MuscleRegionMapping {
  view: BodyView;
  regionIds: readonly string[];
}

// Every muscle group paints one or more silhouette regions on one view.
// OTHER is the unclassified-import bucket and is never painted.
export const MUSCLE_REGIONS = {
  CHEST: { view: 'front', regionIds: ['chest-left', 'chest-right'] },
  BACK_WIDTH: { view: 'back', regionIds: ['lat-left', 'lat-right'] },
  BACK_THICKNESS: { view: 'back', regionIds: ['traps-mid'] },
  SHOULDERS_FRONT: { view: 'front', regionIds: ['delt-front-left', 'delt-front-right'] },
  SHOULDERS_LATERAL: { view: 'front', regionIds: ['delt-side-left', 'delt-side-right'] },
  SHOULDERS_REAR: { view: 'back', regionIds: ['delt-rear-left', 'delt-rear-right'] },
  BICEPS: { view: 'front', regionIds: ['biceps-left', 'biceps-right'] },
  TRICEPS: { view: 'back', regionIds: ['triceps-left', 'triceps-right'] },
  FOREARMS: { view: 'front', regionIds: ['forearm-left', 'forearm-right'] },
  QUADS: { view: 'front', regionIds: ['quad-left', 'quad-right'] },
  HAMSTRINGS: { view: 'back', regionIds: ['ham-left', 'ham-right'] },
  GLUTES: { view: 'back', regionIds: ['glute-left', 'glute-right'] },
  CALVES: { view: 'back', regionIds: ['calf-left', 'calf-right'] },
  ABS: { view: 'front', regionIds: ['abs'] },
  LOWER_BACK: { view: 'back', regionIds: ['lower-back'] },
  OTHER: null,
} as const satisfies Record<MuscleGroup, MuscleRegionMapping | null>;

// Derives the heat level for one muscle from its weekly working sets and the
// resolved MEV/MRV band (personal VolumeTarget or global defaults).
export function muscleHeat(sets: number, band: VolumeBand): HeatLevel {
  if (sets <= 0) return 'none';
  const zone = classifyWeeklySets(sets, band.mev, band.mrv);
  if (zone === 'BELOW_MEV') return 'low';
  if (zone === 'ABOVE_MRV') return 'high';
  return 'optimal';
}

export interface MuscleMapRegion {
  regionId: string;
  group: MuscleGroup;
  view: BodyView;
  level: HeatLevel;
  sets: number;
}

// Builds the serializable region list for one week of set counts. Groups with
// no sets still appear (level 'none') so the whole body always renders; the
// caller passes the same targets map the volume-landmarks card uses, so a
// personal band wins over the defaults identically in both views.
export function buildMuscleMap(
  weeklySets: Record<string, number>,
  targets?: Record<string, { mev: number; mrv: number }>,
): MuscleMapRegion[] {
  return (Object.keys(MUSCLE_REGIONS) as MuscleGroup[]).flatMap((group) => {
    const mapping = MUSCLE_REGIONS[group];
    if (!mapping) return [];
    const sets = weeklySets[group] ?? 0;
    const level = muscleHeat(sets, resolveVolumeBand(group, targets));
    return mapping.regionIds.map((regionId) => ({
      regionId,
      group,
      view: mapping.view,
      level,
      sets,
    }));
  });
}

// ============================================================
// Muscles of one exercise (epic 2.7)
// ============================================================

// How a region reads on an exercise's body map: worked as a primary muscle,
// as a secondary one, or not at all.
export type ExerciseMuscleRole = 'primary' | 'secondary' | 'none';

export interface ExerciseMapRegion {
  regionId: string;
  group: MuscleGroup;
  view: BodyView;
  role: ExerciseMuscleRole;
}

// Every silhouette region, marked by the exercise's muscle contributions
// (lib/training-engine/volume muscleContributions: a share of 1 is primary,
// anything above 0 secondary).
export function exerciseMuscleMap(
  contributions: { group: MuscleGroup; share: number }[],
): ExerciseMapRegion[] {
  const shares = new Map(contributions.map((c) => [c.group, c.share]));
  return (Object.keys(MUSCLE_REGIONS) as MuscleGroup[]).flatMap((group) => {
    const mapping = MUSCLE_REGIONS[group];
    if (!mapping) return [];
    const share = shares.get(group) ?? 0;
    const role: ExerciseMuscleRole = share >= 1 ? 'primary' : share > 0 ? 'secondary' : 'none';
    return mapping.regionIds.map((regionId) => ({ regionId, group, view: mapping.view, role }));
  });
}

// ============================================================
// Compact figure (home "Próximo treino" card, design round 1)
// ============================================================

// The small front/back figure groups the fifteen muscle groups into eleven
// shapes. OTHER is never painted.
export const COMPACT_MUSCLES = [
  'chest',
  'shoulders',
  'abs',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'calves',
  'back',
  'glutes',
  'hams',
] as const;
export type CompactMuscle = (typeof COMPACT_MUSCLES)[number];

export const COMPACT_MUSCLE_OF = {
  CHEST: 'chest',
  BACK_WIDTH: 'back',
  BACK_THICKNESS: 'back',
  LOWER_BACK: 'back',
  SHOULDERS_FRONT: 'shoulders',
  SHOULDERS_LATERAL: 'shoulders',
  SHOULDERS_REAR: 'shoulders',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  FOREARMS: 'forearms',
  QUADS: 'quads',
  HAMSTRINGS: 'hams',
  GLUTES: 'glutes',
  CALVES: 'calves',
  ABS: 'abs',
  OTHER: null,
} as const satisfies Record<MuscleGroup, CompactMuscle | null>;

// The compact shapes a list of muscle groups lights up, in figure order and
// without duplicates (a workout with lats and rows lights "back" once).
export function compactMuscles(groups: Iterable<MuscleGroup>): CompactMuscle[] {
  const lit = new Set<CompactMuscle>();
  for (const group of groups) {
    const muscle = COMPACT_MUSCLE_OF[group];
    if (muscle) lit.add(muscle);
  }
  return COMPACT_MUSCLES.filter((muscle) => lit.has(muscle));
}

// Heat level of each compact shape as 0..3 (heat-0..heat-3 tokens). A shape
// covering several groups takes the hottest one.
const HEAT_INDEX: Record<HeatLevel, 0 | 1 | 2 | 3> = { none: 0, low: 1, optimal: 2, high: 3 };

export function compactHeat(
  regions: Pick<MuscleMapRegion, 'group' | 'level'>[],
): Partial<Record<CompactMuscle, 0 | 1 | 2 | 3>> {
  const out: Partial<Record<CompactMuscle, 0 | 1 | 2 | 3>> = {};
  for (const region of regions) {
    const muscle = COMPACT_MUSCLE_OF[region.group];
    if (!muscle) continue;
    const level = HEAT_INDEX[region.level];
    const current = out[muscle];
    if (current == null || current < level) out[muscle] = level;
  }
  return out;
}
