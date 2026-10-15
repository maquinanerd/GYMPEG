import { describe, expect, it } from 'vitest';
import { findKnowledge, KNOWLEDGE_CARDS, KNOWLEDGE_FILES, shortCitation } from './index';
import { knowledgeCardSchema, type KnowledgeCard } from './schema';

// The real corpus the coach grounds on. These checks keep it honest: valid
// shape, unique ids, traceable sources, and retrieval that finds the card a
// typical trainee question needs.

const FILE_PREFIX: Record<keyof typeof KNOWLEDGE_FILES, string> = {
  'training-variables': 'tv-',
  'progression-recovery': 'pr-',
  'exercise-selection': 'ex-',
  'populations-health': 'ph-',
  nutrition: 'nu-',
  myths: 'my-',
};

describe('knowledge cards corpus', () => {
  it('every card matches the schema', () => {
    for (const card of KNOWLEDGE_CARDS) {
      expect(() => knowledgeCardSchema.parse(card), card.id).not.toThrow();
    }
  });

  it('has a meaningful number of cards in every file', () => {
    expect(KNOWLEDGE_CARDS.length).toBeGreaterThanOrEqual(80);
    for (const [file, cards] of Object.entries(KNOWLEDGE_FILES)) {
      expect((cards as unknown[]).length, file).toBeGreaterThanOrEqual(10);
    }
  });

  it('ids are unique and carry their file prefix', () => {
    const ids = KNOWLEDGE_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [file, cards] of Object.entries(KNOWLEDGE_FILES)) {
      const prefix = FILE_PREFIX[file as keyof typeof KNOWLEDGE_FILES];
      for (const card of cards as KnowledgeCard[])
        expect(card.id.startsWith(prefix), card.id).toBe(true);
    }
  });

  it('every source yields a short "Author, year" citation', () => {
    for (const card of KNOWLEDGE_CARDS) {
      for (const source of card.sources) {
        const short = shortCitation(source);
        expect(short.length, `${card.id}: ${short}`).toBeLessThanOrEqual(60);
        expect(short.endsWith(`, ${source.year}`), `${card.id}: ${short}`).toBe(true);
        expect(source.citation, card.id).toContain(String(source.year));
      }
    }
  });

  it('a DOI always points at the same paper (same year everywhere)', () => {
    const yearByDoi = new Map<string, number>();
    for (const card of KNOWLEDGE_CARDS) {
      for (const source of card.sources) {
        if (!source.doi) continue;
        const doi = source.doi.toLowerCase();
        const seen = yearByDoi.get(doi);
        if (seen != null) expect(source.year, `${card.id}: ${doi}`).toBe(seen);
        yearByDoi.set(doi, source.year);
      }
    }
  });
});

describe('knowledge retrieval on the real corpus', () => {
  const cases: Array<[string, string[]]> = [
    ['Quantas séries por semana eu preciso fazer para crescer o peito?', ['volume']],
    ['Preciso treinar até a falha em todas as séries?', ['failure', 'myths']],
    ['Quanto tempo devo descansar entre as séries?', ['rest']],
    [
      'Estou estagnado no supino há semanas, o que faço?',
      ['progression', 'deload', 'periodization', 'autoregulation'],
    ],
    ['Quanto de proteína por dia eu preciso para ganhar massa?', ['nutrition', 'myths']],
    ['Creatina faz mal para os rins?', ['supplements', 'myths']],
    ['Fazer abdominal perde a barriga?', ['myths', 'body-composition']],
    [
      'Estou com dor na lombar, posso agachar?',
      ['health', 'injury', 'technique', 'exercise-selection'],
    ],
    ['Grávida pode fazer musculação?', ['populations', 'health']],
    ['Corrida atrapalha a hipertrofia?', ['cardio', 'myths']],
    ['Máquina ou peso livre, o que é melhor?', ['exercise-selection', 'myths']],
    ['Quando fazer uma semana de deload?', ['deload', 'recovery']],
  ];

  it.each(cases)('"%s" retrieves a card on the right topic', (question, topics) => {
    const top = findKnowledge(question, 3);
    expect(top.length, question).toBeGreaterThan(0);
    expect(
      top.some((c) => topics.includes(c.topic)),
      `${question} -> ${top.map((c) => `${c.id} (${c.topic})`).join(', ')}`,
    ).toBe(true);
  });

  it('returns nothing for a question outside training science', () => {
    expect(findKnowledge('que IA você é?')).toEqual([]);
    expect(findKnowledge('oi, tudo bem?')).toEqual([]);
    expect(findKnowledge('Obrigado pela ajuda, coach!')).toEqual([]);
    expect(findKnowledge('bom dia')).toEqual([]);
  });
});
