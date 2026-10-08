import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FallbackProvider } from './fallback';
import {
  DEFAULT_PROVIDER_ID,
  getLlmProvider,
  parseProviderId,
  resolveFallbackProviderId,
  resolveProviderId,
} from './index';

// resolveProviderId() and getLlmProvider() select the AI provider from the
// AI_PROVIDER / LLM_PROVIDER / AI_FALLBACK_PROVIDER env vars. We save/restore
// them around every test so this suite never leaks state into the others.
const ENV_KEYS = [
  'AI_PROVIDER',
  'LLM_PROVIDER',
  'AI_FALLBACK_PROVIDER',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
] as const;

describe('lib/llm provider resolution', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe('parseProviderId', () => {
    it('resolves every known id and alias, case and whitespace insensitive', () => {
      expect(parseProviderId('gemini')).toBe('gemini');
      expect(parseProviderId(' Google ')).toBe('gemini');
      expect(parseProviderId('DEEPSEEK')).toBe('deepseek');
      expect(parseProviderId('anthropic')).toBe('anthropic');
      expect(parseProviderId('\topenrouter\n')).toBe('openrouter');
      expect(parseProviderId('CODEX_LB')).toBe('codex-lb');
      expect(parseProviderId('codexlb')).toBe('codex-lb');
      expect(parseProviderId('Demo')).toBe('demo');
    });

    it('returns null for empty or unknown values', () => {
      expect(parseProviderId(undefined)).toBeNull();
      expect(parseProviderId('')).toBeNull();
      expect(parseProviderId('gpt-whatever')).toBeNull();
    });
  });

  describe('resolveProviderId', () => {
    it('defaults to gemini when nothing is set', () => {
      expect(DEFAULT_PROVIDER_ID).toBe('gemini');
      expect(resolveProviderId()).toBe('gemini');
    });

    it('reads AI_PROVIDER first and the legacy LLM_PROVIDER second', () => {
      process.env.LLM_PROVIDER = 'openrouter';
      expect(resolveProviderId()).toBe('openrouter');
      process.env.AI_PROVIDER = 'deepseek';
      expect(resolveProviderId()).toBe('deepseek');
    });

    it('ignores an unknown AI_PROVIDER in favor of a valid LLM_PROVIDER', () => {
      process.env.AI_PROVIDER = 'foo';
      process.env.LLM_PROVIDER = 'demo';
      expect(resolveProviderId()).toBe('demo');
    });

    it('falls back to the default for unknown or empty values', () => {
      process.env.LLM_PROVIDER = 'foo';
      expect(resolveProviderId()).toBe('gemini');
      process.env.LLM_PROVIDER = '';
      expect(resolveProviderId()).toBe('gemini');
    });
  });

  describe('resolveFallbackProviderId', () => {
    it('returns the configured fallback unless it is the primary itself', () => {
      expect(resolveFallbackProviderId('gemini')).toBeNull();
      process.env.AI_FALLBACK_PROVIDER = 'deepseek';
      expect(resolveFallbackProviderId('gemini')).toBe('deepseek');
      expect(resolveFallbackProviderId('deepseek')).toBeNull();
    });
  });

  describe('getLlmProvider', () => {
    it('returns a provider whose id matches the resolved id', () => {
      for (const id of ['gemini', 'deepseek', 'anthropic', 'openrouter', 'codex-lb', 'demo']) {
        process.env.AI_PROVIDER = id;
        expect(getLlmProvider().id).toBe(id);
      }
    });

    it('returns the gemini provider by default', () => {
      expect(getLlmProvider().id).toBe('gemini');
    });

    it('wraps primary and fallback when both are configured', () => {
      process.env.AI_FALLBACK_PROVIDER = 'deepseek';
      process.env.GEMINI_API_KEY = 'g';
      process.env.DEEPSEEK_API_KEY = 'd';
      const provider = getLlmProvider();
      expect(provider).toBeInstanceOf(FallbackProvider);
      expect(provider.id).toBe('gemini');
    });

    it('uses the configured side alone when the other has no key', () => {
      process.env.AI_FALLBACK_PROVIDER = 'deepseek';
      process.env.GEMINI_API_KEY = 'g';
      expect(getLlmProvider()).not.toBeInstanceOf(FallbackProvider);
      expect(getLlmProvider().id).toBe('gemini');

      delete process.env.GEMINI_API_KEY;
      process.env.DEEPSEEK_API_KEY = 'd';
      expect(getLlmProvider().id).toBe('deepseek');
    });
  });
});
