import { z } from 'zod';
import exerciseSelection from './cards/exercise-selection.json';
import myths from './cards/myths.json';
import nutrition from './cards/nutrition.json';
import populationsHealth from './cards/populations-health.json';
import progressionRecovery from './cards/progression-recovery.json';
import trainingVariables from './cards/training-variables.json';
import { formatKnowledgeSection } from './format';
import { buildKnowledgeIndex, searchKnowledge, type KnowledgeIndex } from './retrieve';
import { knowledgeCardSchema, type KnowledgeCard } from './schema';

export { formatKnowledgeSection, shortCitation, EVIDENCE_RULES } from './format';
export { searchKnowledge, buildKnowledgeIndex, tokenize } from './retrieve';
export type { KnowledgeCard, KnowledgeSource } from './schema';

// The coach's curated evidence base: one JSON file per subject, each card an
// original pt-BR summary of the literature with verified sources (see
// docs/16_AI_KNOWLEDGE_BASE.md). Validated once at load: a malformed card
// fails fast instead of reaching a prompt.
export const KNOWLEDGE_FILES = {
  'training-variables': trainingVariables,
  'progression-recovery': progressionRecovery,
  'exercise-selection': exerciseSelection,
  'populations-health': populationsHealth,
  nutrition,
  myths,
} as const;

export const KNOWLEDGE_CARDS: readonly KnowledgeCard[] = Object.values(KNOWLEDGE_FILES).flatMap(
  (cards) => z.array(knowledgeCardSchema).parse(cards),
);

let index: KnowledgeIndex | null = null;

function knowledgeIndex(): KnowledgeIndex {
  index ??= buildKnowledgeIndex(KNOWLEDGE_CARDS);
  return index;
}

// The cards most relevant to a question, best first (empty when none fits).
export function findKnowledge(query: string, limit = 5): KnowledgeCard[] {
  return searchKnowledge(knowledgeIndex(), query, { limit }).map((h) => h.card);
}

// The ready-to-append prompt section for a question.
export function knowledgeSectionFor(query: string, limit = 5): string {
  return formatKnowledgeSection(findKnowledge(query, limit));
}
