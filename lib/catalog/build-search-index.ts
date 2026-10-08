import { normalizeExerciseText, type CatalogFile } from '@/lib/catalog/catalog-schema';

// Pure builder for data/catalog/search-index.json (see
// scripts/build-catalog-index.ts): names and normalized search terms only.
export function buildSearchIndex(catalog: CatalogFile) {
  return {
    version: catalog.version,
    entries: catalog.exercises.map((exercise) => {
      const terms = new Set<string>();
      for (const value of [
        exercise.name,
        exercise.namePtBr,
        ...exercise.aliases.pt,
        ...exercise.aliases.en,
        ...exercise.legacyNames,
      ]) {
        const normalized = normalizeExerciseText(value);
        if (normalized) terms.add(normalized);
      }
      return {
        name: exercise.name,
        namePtBr: exercise.namePtBr,
        legacyNames: exercise.legacyNames,
        terms: [...terms],
      };
    }),
  };
}
