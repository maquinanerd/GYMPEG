import type { KnowledgeCard } from './schema';

// ============================================================
// Lexical retrieval over the knowledge cards (BM25)
// ============================================================
// Pure and deterministic: the same question always pulls the same cards, so
// what grounded an answer can be reproduced and tested. The corpus is small
// (a few hundred cards at most), so an in-memory index built once per process
// is enough; no embeddings, no external service.

const BM25_K1 = 1.2;
const BM25_B = 0.75;

// Title and keywords say what a card is about; they weigh more than the body.
const FIELD_WEIGHTS = { title: 3, keywords: 3, summary: 1, practice: 1 } as const;

// A multi-word keyword found verbatim in the question ("volume semanal",
// "dor nas costas") is a strong signal on top of its single words.
const PHRASE_BONUS = 2;

// A card must score at least this much, and at least this fraction of the best
// card, to be returned: weak lexical overlaps ("treino" alone) stay out.
const MIN_SCORE = 1.5;
const MIN_RELATIVE_SCORE = 0.35;

// Function words in pt-BR and English, plus filler common to every gym
// question; matching on them would rank cards by noise.
const STOPWORDS = new Set(
  (
    'a o e os as um uma uns umas de do da dos das no na nos nas em ao aos pelo pela pelos pelas por para pra pro ' +
    'com sem que se nao sim mais menos muito muita muitos muitas pouco pouca ja so ou mas como qual quais quando ' +
    'onde quem porque pois isso isto esse essa este esta aquele aquela eu voce voces ele ela eles elas meu minha ' +
    'meus minhas seu sua seus suas nosso nossa me te lhe nos ser estar ter tem tenho fazer faz faco fiz posso pode ' +
    'devo deve vou vai sou foi era e tambem ainda entao agora hoje dia oi ola obrigado ok bom boa melhor melhores ' +
    'tudo bem beleza valeu obrigada favor ajuda ajudar coach ne ta to coisa algo algum alguma tipo assim aqui la ' +
    'cara mano gente poderia queria quero gostaria sobre saber dizer fala falar ' +
    'hi hello hey thanks thank please help ' +
    'the an and or of to in on at for with without is are was were be been being do does did can could should ' +
    'would will my me i you your it its this that these those what which who how when why there here about ' +
    'than then so if not no yes get got have has had more most less very much many'
  ).split(/\s+/),
);

// Lowercase, strip accents (NFD + combining marks), so "séries" == "series".
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// Light stemming for pt-BR and English: drop a plural "s" and keep the first
// six characters, so "agachamento"/"agachar" and "series"/"serie" meet.
export function stem(token: string): string {
  const singular = token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token;
  return singular.slice(0, 6);
}

function rawTokens(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function tokenize(text: string): string[] {
  return rawTokens(text).map(stem);
}

interface IndexedCard {
  card: KnowledgeCard;
  termFrequency: Map<string, number>;
  length: number;
  // Multi-word keywords as normalized token sequences, for the phrase bonus.
  phrases: string[];
}

export interface KnowledgeIndex {
  cards: IndexedCard[];
  documentFrequency: Map<string, number>;
  averageLength: number;
}

export interface KnowledgeHit {
  card: KnowledgeCard;
  score: number;
}

function addTerms(target: Map<string, number>, terms: string[], weight: number): number {
  for (const term of terms) target.set(term, (target.get(term) ?? 0) + weight);
  return terms.length * weight;
}

export function buildKnowledgeIndex(cards: readonly KnowledgeCard[]): KnowledgeIndex {
  const documentFrequency = new Map<string, number>();
  const indexed: IndexedCard[] = cards.map((card) => {
    const termFrequency = new Map<string, number>();
    let length = 0;
    length += addTerms(termFrequency, tokenize(card.title), FIELD_WEIGHTS.title);
    length += addTerms(termFrequency, tokenize(card.keywords.join(' ')), FIELD_WEIGHTS.keywords);
    length += addTerms(termFrequency, tokenize(card.summary), FIELD_WEIGHTS.summary);
    length += addTerms(termFrequency, tokenize(card.practice.join(' ')), FIELD_WEIGHTS.practice);
    for (const term of termFrequency.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    const phrases = card.keywords.map((k) => rawTokens(k).join(' ')).filter((p) => p.includes(' '));
    return { card, termFrequency, length, phrases };
  });
  const totalLength = indexed.reduce((acc, c) => acc + c.length, 0);
  return {
    cards: indexed,
    documentFrequency,
    averageLength: indexed.length > 0 ? totalLength / indexed.length : 0,
  };
}

// Ranks the cards for a free-text question. Returns at most `limit` cards that
// clear both the absolute and the relative score floor, best first; an
// off-topic question ("who are you?") returns nothing.
export function searchKnowledge(
  index: KnowledgeIndex,
  query: string,
  options: { limit?: number } = {},
): KnowledgeHit[] {
  const limit = options.limit ?? 5;
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0 || index.cards.length === 0) return [];
  const normalizedQuery = ` ${rawTokens(query).join(' ')} `;
  const total = index.cards.length;

  const hits: KnowledgeHit[] = [];
  for (const doc of index.cards) {
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.termFrequency.get(term);
      if (!tf) continue;
      const df = index.documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      const norm = 1 - BM25_B + (BM25_B * doc.length) / (index.averageLength || 1);
      score += (idf * tf * (BM25_K1 + 1)) / (tf + BM25_K1 * norm);
    }
    for (const phrase of doc.phrases) {
      if (normalizedQuery.includes(` ${phrase} `)) score += PHRASE_BONUS;
    }
    if (score > 0) hits.push({ card: doc.card, score });
  }

  hits.sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
  const best = hits[0]?.score ?? 0;
  const floor = Math.max(MIN_SCORE, best * MIN_RELATIVE_SCORE);
  return hits.filter((h) => h.score >= floor).slice(0, limit);
}
