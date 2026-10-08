import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecuritySection } from './security-section';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

async function fillPassword(current: string, next: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Current password'), current);
  await user.type(screen.getByLabelText('New password'), next);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('SecuritySection', () => {
  it('validates length and confirmation before calling the API', async () => {
    const fetchFn = mockFetch(200, {});
    render(<SecuritySection otherSessions={0} />);

    await fillPassword('old-password', 'short', 'short');
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'long-enough-1');
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'long-enough-2');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('do not match');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('changes the password and reports the devices signed out', async () => {
    const fetchFn = mockFetch(200, { ok: true, signedOutSessions: 2 });
    render(<SecuritySection otherSessions={2} />);

    await fillPassword('old-password', 'new-password-1', 'new-password-1');

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/auth/password',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)).toEqual({
      currentPassword: 'old-password',
      newPassword: 'new-password-1',
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Password changed. 2 other devices were signed out.',
    );
    expect(screen.getByText('Only this device is signed in.')).toBeInTheDocument();
  });

  it('shows the wrong-password message on a 400', async () => {
    mockFetch(400, { error: 'Current password is incorrect.' });
    render(<SecuritySection otherSessions={0} />);

    await fillPassword('bad-password', 'new-password-1', 'new-password-1');
    expect(screen.getByRole('alert')).toHaveTextContent('Current password is incorrect');
  });

  it('signs out the other devices and disables the button when none remain', async () => {
    const fetchFn = mockFetch(200, { ok: true, signedOutSessions: 1 });
    render(<SecuritySection otherSessions={1} />);
    expect(screen.getByText('1 other device is signed in.')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Sign out other devices' });
    await userEvent.setup().click(button);

    expect(fetchFn).toHaveBeenCalledWith('/api/auth/sessions', { method: 'DELETE' });
    expect(toast.success).toHaveBeenCalledWith('1 device signed out.');
    expect(button).toBeDisabled();
  });
});
