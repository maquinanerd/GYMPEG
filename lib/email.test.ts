import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmailProvider, resolvePublicAppUrl } from './email';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getEmailProvider', () => {
  it('has no provider unless one is configured completely', () => {
    expect(getEmailProvider({})).toBeNull();
    expect(getEmailProvider({ EMAIL_PROVIDER: 'carrier-pigeon' })).toBeNull();
    expect(getEmailProvider({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'k' })).toBeNull();
    expect(getEmailProvider({ EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'a@b.c' })).toBeNull();
  });

  it('never logs messages in production', () => {
    expect(getEmailProvider({ EMAIL_PROVIDER: 'log', NODE_ENV: 'production' })).toBeNull();
    expect(getEmailProvider({ EMAIL_PROVIDER: 'log', NODE_ENV: 'development' })?.name).toBe('log');
  });

  it('sends through the Resend API with the key and sender', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = getEmailProvider({
      EMAIL_PROVIDER: 'Resend',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'GYM Peg <no-reply@gympeg.test>',
    });
    await provider!.send({ to: 'lifter@test.dev', subject: 'Hi', text: 'Body' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toEqual({
      from: 'GYM Peg <no-reply@gympeg.test>',
      to: ['lifter@test.dev'],
      subject: 'Hi',
      text: 'Body',
    });
  });

  it('fails without echoing the provider response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('lifter@test.dev is invalid', { status: 422 })),
    );
    const provider = getEmailProvider({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'no-reply@gympeg.test',
    });
    await expect(
      provider!.send({ to: 'lifter@test.dev', subject: 's', text: 't' }),
    ).rejects.toThrow('E-mail provider rejected the message (HTTP 422).');
  });
});

describe('resolvePublicAppUrl', () => {
  it('uses the configured origin and never the request in production', () => {
    expect(resolvePublicAppUrl({ APP_URL: 'https://gympeg.app/some/path' })).toBe(
      'https://gympeg.app',
    );
    expect(resolvePublicAppUrl({ NEXTAUTH_URL: 'https://auth.gympeg.app' })).toBe(
      'https://auth.gympeg.app',
    );
    expect(
      resolvePublicAppUrl({ APP_URL: 'not a url', NEXTAUTH_URL: 'https://fallback.app' }),
    ).toBe('https://fallback.app');
    expect(resolvePublicAppUrl({ NODE_ENV: 'production' }, 'https://evil.example')).toBeNull();
    expect(resolvePublicAppUrl({ NODE_ENV: 'development' }, 'http://localhost:3030')).toBe(
      'http://localhost:3030',
    );
  });
});
