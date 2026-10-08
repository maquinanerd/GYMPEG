import { readSseDeltas } from './sse-reader';
import {
  LlmError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
  type LlmUsage,
} from './types';

// Google Gemini through the Generative Language REST API (v1beta). Default is
// the cheap, fast Flash-Lite tier recommended for workout planning; override
// with GEMINI_MODEL. Model ids: https://ai.google.dev/gemini-api/docs/models
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_MAX_TOKENS = 8000;

interface GeminiPart {
  text?: string;
  // Thinking models may return their reasoning as parts flagged `thought`;
  // only the answer parts belong in the completion text.
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export function buildGeminiRequestBody(req: LlmCompletionRequest) {
  return {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      ...(req.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

export function geminiResponseText(json: GeminiResponse): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
}

export function geminiUsage(json: GeminiResponse): LlmUsage | undefined {
  const meta = json.usageMetadata;
  if (!meta) return undefined;
  return {
    inputTokens: meta.promptTokenCount ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
  };
}

// Parses one SSE line from streamGenerateContent?alt=sse. Returns the answer
// text of that chunk, or null for blank lines, non-data lines and bad JSON.
export function extractGeminiDelta(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (payload === '') return null;
  try {
    const text = geminiResponseText(JSON.parse(payload) as GeminiResponse);
    return text === '' ? null : text;
  } catch {
    return null;
  }
}

export class GeminiProvider implements LlmProvider {
  readonly id = 'gemini' as const;
  readonly label = 'Google Gemini';
  readonly apiKeyEnvVar = 'GEMINI_API_KEY';
  readonly model: string;
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
    this.model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // The key travels in a header, never in the URL, so it cannot leak through
  // access logs or error messages that echo the request URL.
  private async post(url: string, req: LlmCompletionRequest): Promise<Response> {
    if (!this.apiKey) {
      throw new LlmError(503, 'GEMINI_API_KEY is not configured.');
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify(buildGeminiRequestBody(req)),
      });
    } catch (err) {
      throw new LlmError(
        502,
        `Network failure to Gemini: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new LlmError(res.status, `Gemini ${res.status}: ${text.slice(0, 500)}`);
    }
    return res;
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const res = await this.post(`${API_BASE}/models/${this.model}:generateContent`, req);
    const json = (await res.json()) as GeminiResponse;

    if (json.error) {
      throw new LlmError(502, `Gemini: ${json.error.message ?? json.error.status ?? 'error'}`);
    }
    if (json.promptFeedback?.blockReason) {
      throw new LlmError(502, `Gemini blocked the request (${json.promptFeedback.blockReason}).`);
    }
    if (json.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new LlmError(
        502,
        'The coach response was cut off: the model hit its output token budget. Retry or raise maxTokens.',
      );
    }
    const text = geminiResponseText(json).trim();
    if (!text) {
      throw new LlmError(502, 'Empty response from the coach.');
    }
    return { text, modelUsed: json.modelVersion ?? this.model, usage: geminiUsage(json) };
  }

  async *stream(req: LlmCompletionRequest): AsyncIterable<string> {
    const res = await this.post(
      `${API_BASE}/models/${this.model}:streamGenerateContent?alt=sse`,
      req,
    );
    if (!res.body) {
      throw new LlmError(502, 'Gemini returned no response body.');
    }
    yield* readSseDeltas(res.body, extractGeminiDelta);
  }
}
