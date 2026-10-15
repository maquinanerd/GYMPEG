import { describe, expect, it } from 'vitest';
import { formatKnowledgeSection, shortCitation } from './format';
import type { KnowledgeCard } from './schema';

const CARD: KnowledgeCard = {
  id: 'tv-volume',
  topic: 'volume',
  title: 'Volume semanal e hipertrofia',
  keywords: ['volume', 'séries', 'semana'],
  summary:
    'Mais séries semanais por músculo tendem a gerar mais hipertrofia, com retorno decrescente acima de certo ponto.',
  practice: ['Comece com 10 séries semanais por músculo.'],
  evidence: 'strong',
  sources: [
    {
      citation:
        'Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci. 2017;35(11):1073-1082.',
      year: 2017,
      doi: '10.1080/02640414.2016.1210197',
    },
  ],
};

describe('shortCitation', () => {
  it('abbreviates three or more authors to et al.', () => {
    expect(shortCitation(CARD.sources[0]!)).toBe('Schoenfeld et al., 2017');
  });

  it('names both authors of a two-author paper', () => {
    expect(
      shortCitation({
        citation: 'Schoenfeld BJ, Aragon AA. How much protein can the body use. JISSN. 2018;15:10.',
        year: 2018,
        doi: '10.1186/s12970-018-0215-1',
      }),
    ).toBe('Schoenfeld & Aragon, 2018');
  });

  it('keeps a corporate author whole', () => {
    expect(
      shortCitation({
        citation:
          'World Health Organization. WHO guidelines on physical activity and sedentary behaviour. Geneva: WHO; 2020.',
        year: 2020,
        url: 'https://www.who.int/publications/i/item/9789240015128',
      }),
    ).toBe('World Health Organization, 2020');
  });
});

describe('formatKnowledgeSection', () => {
  it('lists each card with its id, evidence level, practice and sources', () => {
    const text = formatKnowledgeSection([CARD]);
    expect(text).toContain('[tv-volume] Volume semanal e hipertrofia (evidence: strong)');
    expect(text).toContain('- Comece com 10 séries semanais por músculo.');
    expect(text).toContain('(Schoenfeld et al., 2017)');
    expect(text).toContain('doi:10.1080/02640414.2016.1210197');
  });

  it('always carries the no-invented-citation rule', () => {
    for (const text of [formatKnowledgeSection([CARD]), formatKnowledgeSection([])]) {
      expect(text).toMatch(/never invent a study/i);
      expect(text).toMatch(/no curated source/i);
    }
  });

  it('forbids citations when no card matched', () => {
    expect(formatKnowledgeSection([])).toMatch(/do not cite any study/i);
  });
});
