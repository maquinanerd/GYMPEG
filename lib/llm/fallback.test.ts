import { describe, expect, it, vi } from 'vitest';
import { classifyLlmError, FallbackProvider } from './fallback';
import { LlmError, type LlmCompletionRequest, type LlmProvider } from './types';

const req: LlmCompletionRequest = { system: 'S', messages: [{ role: 'user', content: 'x' }] };

function fakeProvider(
  id: LlmProvider['id'],
  complete: LlmProvider['complete'],
  stream?: LlmProvider['stream'],
): LlmProvider & { complete: ReturnType<typeof vi.fn> } {
  return {
    id,
    label: id,
    apiKeyEnvVar: `${id.toUpperCase()}_API_KEY`,
    model: `${id}-model`,
    isConfigured: () => true,
    complete: vi.fn(complete),
    stream:
      stream ??
      async function* () {
        yield '';
      },
  };
}

const ok = (text: string) => async () => ({ text, modelUsed: 'm' });
const fail = (status: number) => async () => {
  throw new LlmError(status, `status ${status}`);
};

function build(primary: LlmProvider, fallback: LlmProvider) {
  const sleep = vi.fn(async () => {});
  return { provider: new FallbackProvider(primary, fallback, { retryDelayMs: 10, sleep }), sleep };
}

describe('classifyLlmError', () => {
  it('classifies by status', () => {
    expect(classifyLlmError(new LlmError(429, ''))).toBe('transient');
    expect(classifyLlmError(new LlmError(503, ''))).toBe('transient');
    expect(classifyLlmError(new LlmError(401, ''))).toBe('provider');
    expect(classifyLlmError(new LlmError(404, ''))).toBe('provider');
    expect(classifyLlmError(new LlmError(400, ''))).toBe('fatal');
    expect(classifyLlmError(new TypeError('bug'))).toBe('fatal');
  });
});

describe('FallbackProvider.complete', () => {
  it('exposes the primary identity', () => {
    const { provider } = build(fakeProvider('gemini', ok('a')), fakeProvider('deepseek', ok('b')));
    expect(provider.id).toBe('gemini');
    expect(provider.model).toBe('gemini-model');
  });

  it('uses the primary when it succeeds', async () => {
    const fallback = fakeProvider('deepseek', ok('b'));
    const { provider } = build(fakeProvider('gemini', ok('a')), fallback);
    expect((await provider.complete(req)).text).toBe('a');
    expect(fallback.complete).not.toHaveBeenCalled();
  });

  it('retries a transient failure once before falling back', async () => {
    const primary = fakeProvider('gemini', fail(503));
    primary.complete.mockImplementationOnce(fail(503)).mockImplementationOnce(ok('retried'));
    const fallback = fakeProvider('deepseek', ok('b'));
    const { provider, sleep } = build(primary, fallback);

    expect((await provider.complete(req)).text).toBe('retried');
    expect(primary.complete).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
    expect(fallback.complete).not.toHaveBeenCalled();
  });

  it('falls back after the retry also fails', async () => {
    const primary = fakeProvider('gemini', fail(429));
    const fallback = fakeProvider('deepseek', ok('fallback'));
    const { provider } = build(primary, fallback);

    expect((await provider.complete(req)).text).toBe('fallback');
    expect(primary.complete).toHaveBeenCalledTimes(2);
    expect(fallback.complete).toHaveBeenCalledTimes(1);
  });

  it('skips the retry when the primary is misconfigured', async () => {
    const primary = fakeProvider('gemini', fail(401));
    const fallback = fakeProvider('deepseek', ok('fallback'));
    const { provider, sleep } = build(primary, fallback);

    expect((await provider.complete(req)).text).toBe('fallback');
    expect(primary.complete).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rethrows invalid-request errors and bugs without calling the fallback', async () => {
    const fallback = fakeProvider('deepseek', ok('b'));
    const { provider } = build(fakeProvider('gemini', fail(400)), fallback);
    await expect(provider.complete(req)).rejects.toMatchObject({ status: 400 });

    const buggy = fakeProvider('gemini', async () => {
      throw new TypeError('bug');
    });
    const { provider: p2 } = build(buggy, fallback);
    await expect(p2.complete(req)).rejects.toBeInstanceOf(TypeError);
    expect(fallback.complete).not.toHaveBeenCalled();
  });
});

describe('FallbackProvider.stream', () => {
  async function collect(it: AsyncIterable<string>) {
    const out: string[] = [];
    for await (const c of it) out.push(c);
    return out;
  }

  it('falls back when the primary fails before the first chunk', async () => {
    const primary = fakeProvider('gemini', ok('a'), async function* () {
      throw new LlmError(503, 'down');
    });
    const fallback = fakeProvider('deepseek', ok('b'), async function* () {
      yield 'from ';
      yield 'fallback';
    });
    const { provider } = build(primary, fallback);
    expect(await collect(provider.stream(req))).toEqual(['from ', 'fallback']);
  });

  it('rethrows once part of the answer was streamed', async () => {
    const primary = fakeProvider('gemini', ok('a'), async function* () {
      yield 'partial';
      throw new LlmError(503, 'dropped');
    });
    const fallbackStream = vi.fn(async function* () {
      yield 'never';
    });
    const { provider } = build(primary, fakeProvider('deepseek', ok('b'), fallbackStream));

    await expect(collect(provider.stream(req))).rejects.toMatchObject({ status: 503 });
    expect(fallbackStream).not.toHaveBeenCalled();
  });
});
