import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The router is irrelevant to these assertions; stub it so the component mounts.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

// The demo flag/credentials are read at module load, so re-import after stubbing.
async function renderForm() {
  vi.resetModules();
  const { LoginForm } = await import('./login-form');
  return render(<LoginForm />);
}

// The first import transforms the whole graph (the icon set is large); doing
// it once up front keeps that cost out of each test's own timeout.
beforeAll(async () => {
  await import('./login-form');
}, 60_000);

describe('LoginForm demo banner', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not render the demo banner when NEXT_PUBLIC_DEMO_MODE is unset', async () => {
    await renderForm();
    expect(screen.queryByText('Demo account')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /log in as demo/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the demo credentials and logs in with one click when demo mode is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('NEXT_PUBLIC_DEMO_EMAIL', 'demo@gympeg.app');
    vi.stubEnv('NEXT_PUBLIC_DEMO_PASSWORD', 'gympegdemo');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await renderForm();

    expect(screen.getByText('Demo account')).toBeInTheDocument();
    expect(
      screen.getByText('demo@gympeg.app / gympegdemo'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /log in as demo/i }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'demo@gympeg.app',
          password: 'gympegdemo',
        }),
      }),
    );
  });
});

describe('LoginForm fields', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ties each validation error to its field', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Invalid email');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says the form needs a connection while the device is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await renderForm();

    expect(screen.getByRole('status')).toHaveTextContent(/no connection/i);
  });
});
