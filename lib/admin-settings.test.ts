import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { secretUpdateSchema, settingsUpdateSchema } from '@/lib/admin-settings';
import englishMessages from '@/messages/en';
import brazilianPortugueseMessages from '@/messages/pt-BR';

const parse = (settings: Record<string, string | null>) =>
  settingsUpdateSchema.safeParse({ settings });

describe('settingsUpdateSchema', () => {
  it('accepts the panel providers, model ids, features, prices and senders', () => {
    const result = parse({
      AI_PROVIDER: 'gemini',
      AI_FALLBACK_PROVIDER: '',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
      OPENROUTER_MODEL: 'anthropic/claude-sonnet-4.5',
      AI_FEATURES_DISABLED: 'ai.chat, ai.weekly_review',
      AI_COST_PER_MTOKEN_INPUT: '0.10',
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'GYM Peg <nao-responda@gympeg.online>',
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ AI_FALLBACK_PROVIDER: '', AI_PROVIDER: 'gemini' });
  });

  it('keeps null as "clear the panel value"', () => {
    expect(parse({ AI_PROVIDER: null }).data).toEqual({ AI_PROVIDER: null });
  });

  it.each([
    [{ AI_PROVIDER: 'codex-lb' }],
    [{ AI_PROVIDER: '' }],
    [{ GEMINI_MODEL: 'has spaces' }],
    [{ AI_FEATURES_DISABLED: 'ai.chat,ai.mind_reading' }],
    [{ AI_COST_PER_MTOKEN_OUTPUT: '1e9' }],
    [{ EMAIL_PROVIDER: 'log' }],
    [{ EMAIL_FROM: 'GYM Peg' }],
    [{ JWT_SECRET: 'anything' }],
  ])('rejects %o', (settings) => {
    expect(parse(settings).success).toBe(false);
  });
});

describe('secretUpdateSchema', () => {
  it('takes a known key with a plausible value, or null to remove it', () => {
    expect(secretUpdateSchema.safeParse({ key: 'GEMINI_API_KEY', value: ' AIza-abc-12345 ' }).data)
      .toEqual({ key: 'GEMINI_API_KEY', value: 'AIza-abc-12345' });
    expect(secretUpdateSchema.safeParse({ key: 'RESEND_API_KEY', value: null }).success).toBe(true);
  });

  it('refuses unknown keys, short values and values with spaces', () => {
    expect(secretUpdateSchema.safeParse({ key: 'DATABASE_URL', value: 'postgres://x' }).success).toBe(false);
    expect(secretUpdateSchema.safeParse({ key: 'GEMINI_API_KEY', value: 'short' }).success).toBe(false);
    expect(secretUpdateSchema.safeParse({ key: 'GEMINI_API_KEY', value: 'two words here' }).success).toBe(false);
  });
});

describe('sender examples in the panel texts', () => {
  // "<address>" would be read as a rich-text tag by ICU; the messages quote it.
  it('render the angle brackets literally', () => {
    const en = createTranslator({ locale: 'en', messages: englishMessages, namespace: 'admin.email' });
    const pt = createTranslator({
      locale: 'pt-BR',
      messages: brazilianPortugueseMessages,
      namespace: 'admin.email',
    });
    expect(en('fromPlaceholder')).toBe('GYM Peg <no-reply@your-domain.com>');
    expect(pt('invalidSender')).toBe(
      'Confira o remetente: nome e e-mail, como GYM Peg <nao-responda@dominio.com>.',
    );
    expect(settingsUpdateSchema.safeParse({ settings: { EMAIL_FROM: en('fromPlaceholder') } }).success).toBe(true);
  });
});
