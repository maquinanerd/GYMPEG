import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractGeminiDelta, GeminiProvider } from './gemini';
import { LlmError } from './types';

const ENV_KEYS = ['GEMINI_API_KEY', 'GEMINI_MODEL'] as const;
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

function sseBody(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

const okJson = (json: unknown) => () => ({ ok: true, json: async () => json });

describe('GeminiProvider', () => {
  it('defaults to gemini-3.5-flash-lite and honors GEMINI_MODEL', () => {
    expect(new GeminiProvider().model).toBe('gemini-3.5-flash-lite');
    process.env.GEMINI_MODEL = ' gemini-3.5-flash ';
    expect(new GeminiProvider().model).toBe('gemini-3.5-flash');
  });

  it('is not configured without a key (blank counts as missing)', async () => {
    process.env.GEMINI_API_KEY = '   ';
    const p = new GeminiProvider();
    expect(p.isConfigured()).toBe(false);
    await expect(
      p.complete({ system: 'S', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('sends system instruction, mapped roles and JSON mode; key only in a header', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    const fetchFn = mockFetch(
      okJson({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, thoughtsTokenCount: 5 },
        modelVersion: 'gemini-3.5-flash-lite-001',
      }),
    );

    const res = await new GeminiProvider().complete({
      system: 'SYSTEM',
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'plan' },
      ],
      maxTokens: 999,
      temperature: 0.2,
      responseFormat: 'json',
    });

    expect(res).toEqual({
      text: '{"ok":true}',
      modelUsed: 'gemini-3.5-flash-lite-001',
      usage: { inputTokens: 120, outputTokens: 35 },
    });

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    expect(url).not.toContain('g-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('g-key');
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'SYSTEM' }] });
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(body.generationConfig).toEqual({
      maxOutputTokens: 999,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });
  });

  it('omits JSON mode and temperature when not requested', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    const fetchFn = mockFetch(okJson({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
    await new GeminiProvider().complete({
      system: 'S',
      messages: [{ role: 'user', content: 'x' }],
    });
    const body = JSON.parse(fetchFn.mock.calls[0]![1].body as string);
    expect(body.generationConfig).toEqual({ maxOutputTokens: 8000 });
  });

  it('drops thought parts from the answer', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    mockFetch(
      okJson({
        candidates: [
          {
            content: { parts: [{ text: 'thinking...', thought: true }, { text: 'answer' }] },
          },
        ],
      }),
    );
    const res = await new GeminiProvider().complete({
      system: 'S',
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(res.text).toBe('answer');
    expect(res.usage).toBeUndefined();
  });

  it('surfaces the upstream status on a non-ok response', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    mockFetch(() => ({ ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' }));
    await expect(
      new GeminiProvider().complete({ system: 'S', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('wraps network failures as 502', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    );
    await expect(
      new GeminiProvider().complete({ system: 'S', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('rejects truncated, blocked and empty answers', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    const p = new GeminiProvider();
    const req = { system: 'S', messages: [{ role: 'user' as const, content: 'x' }] };

    mockFetch(
      okJson({
        candidates: [{ content: { parts: [{ text: '{"a":' }] }, finishReason: 'MAX_TOKENS' }],
      }),
    );
    await expect(p.complete(req)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('cut off'),
    });

    mockFetch(okJson({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(p.complete(req)).rejects.toMatchObject({
      message: expect.stringContaining('SAFETY'),
    });

    mockFetch(okJson({ candidates: [] }));
    await expect(p.complete(req)).rejects.toBeInstanceOf(LlmError);
  });

  it('streams answer text from SSE chunks split mid-line', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    const fetchFn = mockFetch(() => ({
      ok: true,
      body: sseBody([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\ndata: {"candid',
        'ates":[{"content":{"parts":[{"text":"lo"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"!"}]}}]}',
      ]),
    }));

    const chunks: string[] = [];
    for await (const c of new GeminiProvider().stream({
      system: 'S',
      messages: [{ role: 'user', content: 'x' }],
    })) {
      chunks.push(c);
    }

    expect(chunks.join('')).toBe('Hello!');
    expect(fetchFn.mock.calls[0]![0]).toContain(':streamGenerateContent?alt=sse');
  });
});

describe('extractGeminiDelta', () => {
  it('ignores blank, non-data, thought-only and malformed lines', () => {
    expect(extractGeminiDelta('')).toBeNull();
    expect(extractGeminiDelta(': ping')).toBeNull();
    expect(extractGeminiDelta('data: {broken')).toBeNull();
    expect(
      extractGeminiDelta(
        'data: {"candidates":[{"content":{"parts":[{"text":"x","thought":true}]}}]}',
      ),
    ).toBeNull();
  });
});
