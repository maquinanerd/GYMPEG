// Suggestions for mapping an imported exercise name that matches nothing to
// one of the lifter's exercises (G3 import with manual mapping): candidates
// whose name, pt-BR name or catalog terms contain most words of the imported
// name ("Bench Press (Barbell)" -> "Supino reto com barra"). The lifter picks
// one or keeps "create as new" in the import preview; nothing is guessed at
// import time.

import { normalizeExerciseText } from '@/lib/catalog/catalog-schema';
import { catalogPtBrName, exerciseSearchTerms } from '@/lib/catalog/search-index';

export interface ExerciseCandidate {
  id: string;
  name: string;
}

const MIN_SCORE = 0.5;
// Words that say nothing about the movement (pt-BR and English).
const STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'com',
  'na',
  'no',
  'em',
  'para',
  'the',
  'of',
  'with',
  'and',
  'on',
  'in',
  'to',
]);

function words(text: string): string[] {
  return normalizeExerciseText(text)
    .replace(/[()[\],/-]/g, ' ')
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function suggestExercises(
  importedName: string,
  candidates: ExerciseCandidate[],
  limit = 3,
): ExerciseCandidate[] {
  const wanted = [...new Set(words(importedName))];
  if (wanted.length === 0) return [];
  return candidates
    .map((candidate) => {
      const haystack = [
        normalizeExerciseText(candidate.name),
        normalizeExerciseText(catalogPtBrName(candidate.name) ?? ''),
        ...exerciseSearchTerms(candidate.name),
      ].join(' | ');
      const hits = wanted.filter((word) => haystack.includes(word)).length;
      return { candidate, score: hits / wanted.length };
    })
    .filter((entry) => entry.score >= MIN_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.name.length - b.candidate.name.length ||
        a.candidate.name.localeCompare(b.candidate.name),
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
