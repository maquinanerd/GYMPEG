import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecretField } from './secret-field';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

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

describe('SecretField', () => {
  it('never shows a saved key: only its last 4 characters, and an empty masked field', () => {
    render(
      <SecretField
        secretKey="RESEND_API_KEY"
        label="Resend API key"
        view={{
          panel: { readable: true, last4: 'wxyz', updatedAt: '2026-10-01T10:00:00.000Z' },
          envConfigured: false,
        }}
      />,
    );
    const field = screen.getByLabelText('Resend API key') as HTMLInputElement;
    expect(field).toHaveAttribute('type', 'password');
    expect(field.value).toBe('');
    expect(screen.getByText('Key saved in the panel, ending in wxyz.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('saves a pasted key and clears the field, and offers no remove without a panel key', async () => {
    const fetchFn = mockFetch(200, { ok: true });
    render(
      <SecretField
        secretKey="RESEND_API_KEY"
        label="Resend API key"
        view={{ panel: null, envConfigured: true }}
      />,
    );
    expect(screen.getByText('Using the key set on the server (Coolify).')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    const user = userEvent.setup();
    const field = screen.getByLabelText('Resend API key') as HTMLInputElement;
    await user.type(field, 're_12345678');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fetchFn).toHaveBeenCalledWith('/api/admin/secrets', expect.objectContaining({ method: 'PUT' }));
    expect(JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)).toEqual({
      key: 'RESEND_API_KEY',
      value: 're_12345678',
    });
    expect(toast.success).toHaveBeenCalledWith('Key saved.');
    expect(field.value).toBe('');
  });
});
