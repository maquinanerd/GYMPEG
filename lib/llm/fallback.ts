import {
  LlmError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from './types';

// How a failed call should be handled:
// - transient: rate limit or upstream/network failure; retry the primary once,
//   then fall back.
// - provider: the primary itself is unusable (bad key, unknown model); go
//   straight to the fallback.
// - fatal: the request is invalid (or the error is not a provider error at
//   all, i.e. a bug); another provider would fail the same way, so rethrow.
export type LlmFailureKind = 'transient' | 'provider' | 'fatal';

export function classifyLlmError(err: unknown): LlmFailureKind {
  if (!(err instanceof LlmError)) return 'fatal';
  if (err.status === 429 || err.status >= 500) return 'transient';
  if (err.status === 401 || err.status === 403 || err.status === 404) return 'provider';
  return 'fatal';
}

export interface FallbackOptions {
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_RETRY_DELAY_MS = 750;

// Primary provider with one controlled retry and a single fallback provider.
// Calls are sequential: the two models never run at the same time, so a
// request is billed at most by the attempts that actually happened.
export class FallbackProvider implements LlmProvider {
  readonly id: LlmProvider['id'];
  readonly label: string;
  readonly apiKeyEnvVar: string;
  readonly model: string;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly primary: LlmProvider,
    private readonly fallback: LlmProvider,
    options: FallbackOptions = {},
  ) {
    this.id = primary.id;
    this.label = primary.label;
    this.apiKeyEnvVar = primary.apiKeyEnvVar;
    this.model = primary.model;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  isConfigured(): boolean {
    return this.primary.isConfigured() || this.fallback.isConfigured();
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    try {
      return await this.primary.complete(req);
    } catch (err) {
      const kind = classifyLlmError(err);
      if (kind === 'fatal') throw err;
      if (kind === 'transient') {
        await this.sleep(this.retryDelayMs);
        try {
          return await this.primary.complete(req);
        } catch (retryErr) {
          if (classifyLlmError(retryErr) === 'fatal') throw retryErr;
        }
      }
      return this.fallback.complete(req);
    }
  }

  // Falls back only while nothing has been streamed: once the client received
  // part of an answer, splicing in another model's text would corrupt it.
  async *stream(req: LlmCompletionRequest): AsyncIterable<string> {
    let started = false;
    try {
      for await (const chunk of this.primary.stream(req)) {
        started = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (started || classifyLlmError(err) === 'fatal') throw err;
    }
    yield* this.fallback.stream(req);
  }
}
