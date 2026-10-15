import { describe, expect, it } from 'vitest';
import { buildKnowledgeIndex, normalizeText, searchKnowledge, stem, tokenize } from './retrieve';
import type { KnowledgeCard } from './schema';

function card(id: string, title: string, keywords: string[], summary: string): KnowledgeCard {
  return {
    id,
    topic: 'volume',
    title,
    keywords,
    summary,
    practice: ['Recomendação prática.'],
    evidence: 'moderate',
    sources: [
      {
        citation: 'Author AB, Other CD. A title. J Test. 2020;1(1):1-2.',
        year: 2020,
        doi: '10.1000/test',
      },
    ],
  };
}

const CARDS = [
  card(
    'tv-volume',
    'Volume semanal e hipertrofia',
    ['volume semanal', 'séries por semana', 'quantas séries', 'weekly sets', 'hipertrofia'],
    'Mais séries semanais por músculo tendem a gerar mais hipertrofia, com retorno decrescente.',
  ),
  card(
    'nu-creatine',
    'Creatina: eficácia e segurança',
    ['creatina', 'creatine', 'rim', 'rins', 'suplemento'],
    'A creatina monohidratada aumenta força e massa magra e é segura em pessoas saudáveis.',
  ),
  card(
    'ph-low-back',
    'Dor lombar e musculação',
    ['dor nas costas', 'lombar', 'low back pain', 'coluna'],
    'Exercício resistido é uma ferramenta útil no manejo da dor lombar crônica inespecífica.',
  ),
  card(
    'pr-deload',
    'Deload: quando e como',
    ['deload', 'semana leve', 'fadiga acumulada', 'descarga'],
    'Reduzir volume ou carga por uma semana pode ajudar a dissipar a fadiga acumulada.',
  ),
];

describe('knowledge text processing', () => {
  it('strips accents and lowercases', () => {
    expect(normalizeText('Séries por SEMANA, ção')).toBe('series por semana, cao');
  });

  it('stems plurals and long words so variants meet', () => {
    expect(stem('series')).toBe(stem('serie'));
    expect(stem('agachamento')).toBe(stem('agachar'));
  });

  it('drops stopwords and one-letter tokens', () => {
    expect(tokenize('Quantas séries eu devo fazer para o peito?')).toEqual([
      'quanta',
      'serie',
      'peito',
    ]);
  });
});

describe('searchKnowledge', () => {
  const index = buildKnowledgeIndex(CARDS);

  it('ranks the card that answers the question first', () => {
    const hits = searchKnowledge(index, 'Quantas séries por semana pra peito?');
    expect(hits[0]?.card.id).toBe('tv-volume');
  });

  it('matches across accents and plural forms', () => {
    expect(searchKnowledge(index, 'creatina faz mal pros rins?')[0]?.card.id).toBe('nu-creatine');
    expect(searchKnowledge(index, 'CREATINA')[0]?.card.id).toBe('nu-creatine');
  });

  it('rewards a multi-word keyword found verbatim', () => {
    const hits = searchKnowledge(index, 'estou com dor nas costas, posso treinar?');
    expect(hits[0]?.card.id).toBe('ph-low-back');
  });

  it('returns nothing for an off-topic question', () => {
    expect(searchKnowledge(index, 'que IA você é?')).toEqual([]);
    expect(searchKnowledge(index, '   ')).toEqual([]);
  });

  it('honors the limit and is deterministic', () => {
    const query = 'volume séries creatina deload lombar';
    const a = searchKnowledge(index, query, { limit: 2 });
    const b = searchKnowledge(index, query, { limit: 2 });
    expect(a).toHaveLength(2);
    expect(a.map((h) => h.card.id)).toEqual(b.map((h) => h.card.id));
  });

  it('works on an empty corpus', () => {
    expect(searchKnowledge(buildKnowledgeIndex([]), 'volume')).toEqual([]);
  });
});
