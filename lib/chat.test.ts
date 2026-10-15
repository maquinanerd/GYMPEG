import { describe, it, expect } from 'vitest';
import { chatKnowledgeQuery, deriveConversationTitle } from './chat';

describe('deriveConversationTitle', () => {
  it('keeps a short message as-is', () => {
    expect(deriveConversationTitle('How is my bench progressing?')).toBe(
      'How is my bench progressing?',
    );
  });

  it('collapses whitespace', () => {
    expect(deriveConversationTitle('  hello   world  ')).toBe('hello world');
  });

  it('truncates long messages with an ellipsis', () => {
    const long = 'a'.repeat(100);
    const title = deriveConversationTitle(long);
    expect(title.endsWith('...')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('falls back for an empty message', () => {
    expect(deriveConversationTitle('   ')).toBe('New conversation');
  });
});

describe('chatKnowledgeQuery', () => {
  it('weighs the latest user message and keeps the previous one for follow-ups', () => {
    const query = chatKnowledgeQuery([
      { role: 'user', content: 'Quantas séries por semana?' },
      { role: 'assistant', content: 'Entre 10 e 20 séries.' },
      { role: 'user', content: 'E para iniciantes?' },
    ]);
    expect(query).toBe('E para iniciantes?\nE para iniciantes?\nQuantas séries por semana?');
    expect(query).not.toContain('Entre 10 e 20');
  });

  it('is empty without a user message', () => {
    expect(chatKnowledgeQuery([])).toBe('');
  });
});
