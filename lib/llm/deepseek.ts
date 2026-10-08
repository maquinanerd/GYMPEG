import { extractOpenRouterDelta } from './openrouter';
import { readSseDeltas } from './sse-reader';
import {
  LlmError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from './types';

// DeepSeek through its OpenAI-compatible Chat Completions API. Override the
// model with DEEPSEEK_MODEL. Model ids: https://api-docs.deepseek.com/quick_start/pricing
const API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-flash';
const DEFAULT_MAX_TOKENS = 8000;

interface DeepSeekResponse {
  model?: string;
  choices?: Array<{ message?: { role: string; content: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message: string };
}

export function buildDeepSeekRequestBody(
  model: string,
  req: LlmCompletionRequest,
  stream: boolean,
) {
  return {
    model,
    messages: [
      { role: 'system', content: req.system },
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(req.temperature != null ? { temperature: req.temperature } : {}),
    // DeepSeek's JSON mode requires the prompt itself to ask for JSON; every
    // caller that sets responseFormat 'json' already describes a JSON schema.
    ...(req.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    ...(stream ? { stream: true } : {}),
  };
}

export class DeepSeekProvider implements LlmProvider {
  readonly id = 'deepseek' as const;
  readonly label = 'DeepSeek';
  readonly apiKeyEnvVar = 'DEEPSEEK_API_KEY';
  readonly model: string;
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY?.trim() || undefined;
    this.model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async post(req: LlmCompletionRequest, stream: boolean): Promise<Response> {
    if (!this.apiKey) {
      throw new LlmError(503, 'DEEPSEEK_API_KEY is not configured.');
    }
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(buildDeepSeekRequestBody(this.model, req, stream)),
      });
    } catch (err) {
      throw new LlmError(
        502,
        `Network failure to DeepSeek: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new LlmError(res.status, `DeepSeek ${res.status}: ${text.slice(0, 500)}`);
    }
    return res;
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const res = await this.post(req, false);
    const json = (await res.json()) as DeepSeekResponse;
    if (json.error) {
      throw new LlmError(502, `DeepSeek: ${json.error.message}`);
    }
    const choice = json.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new LlmError(
        502,
        'The coach response was cut off: the model hit its output token budget. Retry or raise maxTokens.',
      );
    }
    const text = choice?.message?.content?.trim();
    if (!text) {
      throw new LlmError(502, 'Empty response from the coach.');
    }
    return {
      text,
      modelUsed: json.model ?? this.model,
      usage: json.usage
        ? {
            inputTokens: json.usage.prompt_tokens ?? 0,
            outputTokens: json.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }

  async *stream(req: LlmCompletionRequest): AsyncIterable<string> {
    const res = await this.post(req, true);
    if (!res.body) {
      throw new LlmError(502, 'DeepSeek returned no response body.');
    }
    // Same Chat Completions SSE framing as OpenRouter; reasoning deltas live in
    // a separate field and are skipped by the extractor.
    yield* readSseDeltas(res.body, extractOpenRouterDelta);
  }
}
