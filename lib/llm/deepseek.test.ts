import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekProvider } from './deepseek';
import { LlmError } from './types';

const ENV_KEYS = ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

function mockFetch(impl: () => Partial<Response>) {
  const fn = vi.fn(async (_url: string, _init: RequestInit) => impl() as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const req = { system: 'S', messages: [{ role: 'user' as const, content: 'x' }] };

describe('DeepSeekProvider', () => {
  it('defaults to deepseek-flash and honors DEEPSEEK_MODEL', () => {
    expect(new DeepSeekProvider().model).toBe('deepseek-flash');
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-pro';
    expect(new DeepSeekProvider().model).toBe('deepseek-v4-pro');
  });

  it('throws 503 without a key', async () => {
    const p = new DeepSeekProvider();
    expect(p.isConfigured()).toBe(false);
    await expect(p.complete(req)).rejects.toMatchObject({ status: 503 });
  });

  it('posts a chat completion with JSON mode and returns text, model and usage', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds-key';
    const fetchFn = mockFetch(() => ({
      ok: true,
      json: async () => ({
        model: 'deepseek-flash',
        choices: [
          { message: { role: 'assistant', content: ' {"ok":true} ' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 40 },
      }),
    }));

    const res = await new DeepSeekProvider().complete({
      system: 'SYSTEM',
      messages: [{ role: 'user', content: 'return json' }],
      maxTokens: 500,
      responseFormat: 'json',
    });

    expect(res).toEqual({
      text: '{"ok":true}',
      modelUsed: 'deepseek-flash',
      usage: { inputTokens: 200, outputTokens: 40 },
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ds-key');
    const body = JSON.parse(init.body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    expect(body.max_tokens).toBe(500);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBeUndefined();
  });

  it('surfaces upstream status and rejects cut-off or empty answers', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds-key';
    const p = new DeepSeekProvider();

    mockFetch(() => ({ ok: false, status: 402, text: async () => 'Insufficient Balance' }));
    await expect(p.complete(req)).rejects.toMatchObject({ status: 402 });

    mockFetch(() => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: '{"a":' }, finish_reason: 'length' }],
      }),
    }));
    await expect(p.complete(req)).rejects.toMatchObject({
      message: expect.stringContaining('cut off'),
    });

    mockFetch(() => ({
      ok: true,
      json: async () => ({ choices: [{ message: { role: 'assistant', content: null } }] }),
    }));
    await expect(p.complete(req)).rejects.toBeInstanceOf(LlmError);
  });

  it('streams content deltas and skips reasoning deltas', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds-key';
    const encoder = new TextEncoder();
    const fetchFn = mockFetch(() => ({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"reasoning_content":"hmm"}}]}\n' +
                'data: {"choices":[{"delta":{"content":"Oi"}}]}\n',
            ),
          );
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"!"}}]}\ndata: [DONE]\n'),
          );
          controller.close();
        },
      }),
    }));

    const chunks: string[] = [];
    for await (const c of new DeepSeekProvider().stream(req)) chunks.push(c);

    expect(chunks).toEqual(['Oi', '!']);
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body as string).stream).toBe(true);
  });
});
