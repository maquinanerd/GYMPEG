import type { KnowledgeCard, KnowledgeSource } from './schema';

// ============================================================
// Knowledge section appended to the coach prompts
// ============================================================

// "Schoenfeld BJ, Ogborn D, Krieger JW. Title..." -> "Schoenfeld et al., 2017".
// A corporate author ("World Health Organization. ...") is kept whole.
export function shortCitation(source: KnowledgeSource): string {
  const authorsPart = source.citation.split('. ')[0] ?? source.citation;
  const authors = authorsPart
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  // Drop trailing initials ("Schoenfeld BJ" -> "Schoenfeld").
  const surname = (author: string) => author.replace(/\s+[A-Z][A-Za-z]{0,2}$/, '').trim();
  const first = surname(authors[0] ?? authorsPart);
  if (authors.length > 2 || /et al/i.test(authorsPart)) {
    return `${first.replace(/\s*et al\.?$/i, '')} et al., ${source.year}`;
  }
  if (authors.length === 2) return `${first} & ${surname(authors[1]!)}, ${source.year}`;
  return `${first}, ${source.year}`;
}

function formatSource(source: KnowledgeSource): string {
  const link = source.doi ? `doi:${source.doi}` : (source.url ?? '');
  return `- (${shortCitation(source)}) ${source.citation}${link ? ` ${link}` : ''}`;
}

function formatCard(card: KnowledgeCard): string {
  return [
    `## [${card.id}] ${card.title} (evidence: ${card.evidence})`,
    card.summary,
    'In practice:',
    ...card.practice.map((p) => `- ${p}`),
    'Sources:',
    ...card.sources.map(formatSource),
  ].join('\n');
}

// The rules travel with the section, so every prompt that grounds on the cards
// states them the same way, and a question with no matching card still gets
// the "no source, no citation" rule.
export const EVIDENCE_RULES = `Training-science claims (volume, frequency, load, failure, rest, progression, recovery, nutrition, supplements, health) must rest on the knowledge cards below or on the trainee's data. Cite the card's source right after the claim it supports, in the short form given in parentheses, e.g. (Schoenfeld et al., 2017). Only cite sources listed in these cards: never invent a study, author, year, percentage or number. When the cards do not cover the question, say plainly that you have no curated source for it, keep to conservative, widely accepted guidance and label it as general guidance. For pain, injury, illness, pregnancy, medication or a diet for a medical condition, give general safety guidance only and refer the trainee to a doctor, physiotherapist or registered dietitian.`;

export function formatKnowledgeSection(cards: readonly KnowledgeCard[]): string {
  const header = `# Knowledge cards (GYM Peg curated evidence)\n${EVIDENCE_RULES}`;
  if (cards.length === 0) {
    return `${header}\n\nNo knowledge card matched this request: do not cite any study in this answer.`;
  }
  return `${header}\n\n${cards.map(formatCard).join('\n\n')}`;
}
