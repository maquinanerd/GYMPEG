import catalog from '@/data/exercise-media.json';

export interface ExerciseMedia {
  datasetId: string;
  frames: [string, string];
  approximate: boolean;
  source: {
    name: string;
    url: string;
    license: string;
  };
}

interface MediaGroup {
  datasetId: string;
  approximate: boolean;
}

// Media is served only from a source the product owner approved for
// production. The bundled free-exercise-db frames are approved although their
// provenance is not verified (docs/EXERCISE_MEDIA_AUDIT.md, ADR-005 revision of
// 2026-10-14); setting approvedForProduction to false turns every frame off
// again while keeping the name -> dataset id mapping for metadata. The groups
// and the files under public/ come from scripts/sync-exercise-media.mjs.
export const exerciseMediaApproved = catalog.source.approvedForProduction === true;

const groupByName = new Map<string, MediaGroup>();

for (const group of catalog.groups) {
  const entry: MediaGroup = {
    datasetId: group.datasetId,
    approximate: 'approximate' in group && group.approximate === true,
  };
  for (const name of group.names) groupByName.set(normalizeExerciseName(name), entry);
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLocaleLowerCase('en-US');
}

// Dataset id of the reference exercise matching this name, if any. Metadata
// only: never implies that media may be displayed.
export function getExerciseDatasetId(name: string): string | null {
  return groupByName.get(normalizeExerciseName(name))?.datasetId ?? null;
}

export function getExerciseMedia(name: string): ExerciseMedia | null {
  if (!exerciseMediaApproved) return null;
  const group = groupByName.get(normalizeExerciseName(name));
  if (!group) return null;
  return {
    datasetId: group.datasetId,
    frames: [
      `/exercise-media/${catalog.source.id}/${group.datasetId}/0.jpg`,
      `/exercise-media/${catalog.source.id}/${group.datasetId}/1.jpg`,
    ],
    approximate: group.approximate,
    source: { name: catalog.source.name, url: catalog.source.url, license: catalog.source.license },
  };
}

export function exerciseMediaCoverage(names: string[]): { covered: string[]; missing: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const name of names) (getExerciseMedia(name) ? covered : missing).push(name);
  return { covered, missing };
}
