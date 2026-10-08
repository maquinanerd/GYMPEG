import { AnthropicProvider } from './anthropic';
import { CodexLbProvider } from './codex-lb';
import { DeepSeekProvider } from './deepseek';
import { DemoProvider } from './demo';
import { FallbackProvider } from './fallback';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';
import type { LlmProvider } from './types';

export * from './types';
export type LlmProviderId = LlmProvider['id'];

// Gemini Flash-Lite is the product default (cheapest capable tier for
// structured workout planning); see docs/spec/02_ADDENDUM_AI_WORKOUT_PLANNING.md.
export const DEFAULT_PROVIDER_ID: LlmProviderId = 'gemini';

// Case-insensitive, whitespace-tolerant. Returns null for empty or unknown
// values so callers can apply their own fallback.
export function parseProviderId(raw: string | undefined): LlmProviderId | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'gemini' || value === 'google') return 'gemini';
  if (value === 'deepseek') return 'deepseek';
  if (value === 'codex-lb' || value === 'codex_lb' || value === 'codexlb') return 'codex-lb';
  if (value === 'openrouter') return 'openrouter';
  if (value === 'anthropic') return 'anthropic';
  if (value === 'demo') return 'demo';
  return null;
}

// AI_PROVIDER wins; LLM_PROVIDER is the legacy name kept for upstream
// compatibility. Unset or unknown values resolve to the default provider.
// 'demo' serves canned responses (no key needed), useful to try the AI screens.
export function resolveProviderId(): LlmProviderId {
  return (
    parseProviderId(process.env.AI_PROVIDER) ??
    parseProviderId(process.env.LLM_PROVIDER) ??
    DEFAULT_PROVIDER_ID
  );
}

// Optional second provider (AI_FALLBACK_PROVIDER). Ignored when it names the
// primary itself.
export function resolveFallbackProviderId(primary: LlmProviderId): LlmProviderId | null {
  const id = parseProviderId(process.env.AI_FALLBACK_PROVIDER);
  return id && id !== primary ? id : null;
}

function createProvider(id: LlmProviderId): LlmProvider {
  switch (id) {
    case 'gemini':
      return new GeminiProvider();
    case 'deepseek':
      return new DeepSeekProvider();
    case 'codex-lb':
      return new CodexLbProvider();
    case 'openrouter':
      return new OpenRouterProvider();
    case 'demo':
      return new DemoProvider();
    case 'anthropic':
      return new AnthropicProvider();
  }
}

// The single entry point to an LLM. No other module talks to a vendor SDK or
// API directly.
export function getLlmProvider(): LlmProvider {
  const primary = createProvider(resolveProviderId());
  const fallbackId = resolveFallbackProviderId(primary.id);
  if (!fallbackId) return primary;

  const fallback = createProvider(fallbackId);
  if (!fallback.isConfigured()) return primary;
  if (!primary.isConfigured()) return fallback;
  return new FallbackProvider(primary, fallback);
}
