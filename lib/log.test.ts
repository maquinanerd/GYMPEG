import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, redactFields } from './log';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('redactFields', () => {
  it('redacts sensitive keys at any depth and serializes errors', () => {
    const err = Object.assign(new Error('boom'), { code: 'P2002' });
    const out = redactFields({
      userId: 'u1',
      email: 'someone@test.dev',
      body: { password: 'x', weightKg: 80, reps: 5, nested: { authorization: 'Bearer t' } },
      err,
    });
    expect(out).toMatchObject({
      userId: 'u1',
      email: '[redacted]',
      body: {
        password: '[redacted]',
        weightKg: '[redacted]',
        reps: 5,
        nested: { authorization: '[redacted]' },
      },
      err: { name: 'Error', message: 'boom', code: 'P2002' },
    });
  });
});

describe('log', () => {
  it('writes one JSON line per event in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    log.error('login.failed', { userId: 'u1', token: 'abc' });
    const line = JSON.parse(String(write.mock.calls[0]![0]));
    expect(line).toMatchObject({
      level: 'error',
      event: 'login.failed',
      userId: 'u1',
      token: '[redacted]',
    });
    expect(typeof line.time).toBe('string');
  });
});
