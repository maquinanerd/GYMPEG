// ============================================================
// LLM provider abstraction
// ============================================================
// A minimal, provider-agnostic surface for Gemini, DeepSeek, Anthropic,
// OpenRouter, codex-lb and the local demo provider. The active provider is
// selected at runtime from AI_PROVIDER (or the legacy LLM_PROVIDER), with an
// optional AI_FALLBACK_PROVIDER (see ./index). No other module may call a
// vendor API directly.

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionRequest {
  // Stable instructions. Providers that support prompt caching mark this as a
  // cache breakpoint.
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  // Honored by providers that accept sampling params (OpenRouter). Ignored by
  // the Anthropic provider: Claude Opus 4.7 rejects temperature/top_p/top_k.
  temperature?: number;
  // 'json' asks providers with a native JSON mode (Gemini, DeepSeek) to return
  // a bare JSON document. Callers still validate the output with Zod: JSON mode
  // guarantees syntax, never the schema. Others ignore it.
  responseFormat?: 'text' | 'json';
}

// Token accounting reported by the provider, when it exposes one. Feeds the
// AI usage/cost log; absent for providers that do not report it.
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmCompletionResult {
  text: string;
  modelUsed: string;
  usage?: LlmUsage;
}

// Carries an HTTP-ish status so API routes can surface a meaningful code.
export class LlmError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmProvider {
  readonly id: 'gemini' | 'deepseek' | 'anthropic' | 'openrouter' | 'codex-lb' | 'demo';
  // Human-friendly name and the env var holding the key, used by the UI to
  // tell the user what to configure when no key is present.
  readonly label: string;
  readonly apiKeyEnvVar: string;
  readonly model: string;
  isConfigured(): boolean;
  complete(req: LlmCompletionRequest): Promise<LlmCompletionResult>;
  // Streams text deltas as they arrive. Same request shape as complete().
  stream(req: LlmCompletionRequest): AsyncIterable<string>;
}
