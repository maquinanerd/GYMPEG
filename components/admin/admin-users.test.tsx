import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserRow } from '@/lib/admin';
import { AdminUsers } from './admin-users';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const USERS: AdminUserRow[] = [
  {
    id: 'admin-1',
    email: 'admin@test.dev',
    displayName: 'Pablo',
    role: 'ADMIN',
    createdAt: '2026-10-01T10:00:00.000Z',
    lastSeenAt: '2026-10-14T10:00:00.000Z',
  },
  {
    id: 'user-2',
    email: 'ana@test.dev',
    displayName: null,
    role: 'USER',
    createdAt: '2026-10-02T10:00:00.000Z',
    lastSeenAt: null,
  },
];

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function renderList() {
  render(<AdminUsers users={USERS} currentUserId="admin-1" />);
}

async function openDialogFor(email: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: `Set password for ${email}` }));
  return { user, dialog: await screen.findByRole('dialog') };
}

describe('AdminUsers', () => {
  it('lists every account and offers no reset on the admin’s own row', () => {
    renderList();
    expect(screen.getByText('2 accounts')).toBeInTheDocument();
    expect(screen.getByText('admin@test.dev')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Never signed in')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Set password for admin@test.dev' }),
    ).not.toBeInTheDocument();
  });

  it('checks the length before calling the API', async () => {
    const fetchFn = mockFetch(200, {});
    renderList();
    const { user, dialog } = await openDialogFor('ana@test.dev');

    await user.type(within(dialog).getByLabelText('New password'), 'short');
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sets a generated password and shows it to hand over', async () => {
    const fetchFn = mockFetch(200, { ok: true, signedOutSessions: 1 });
    renderList();
    const { user, dialog } = await openDialogFor('ana@test.dev');

    await user.click(within(dialog).getByRole('button', { name: 'Generate' }));
    const generated = (within(dialog).getByLabelText('New password') as HTMLInputElement).value;
    expect(generated).toHaveLength(14);
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }));

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/admin/users/user-2/password',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)).toEqual({
      password: generated,
    });
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Password set. 1 device was signed out.',
    );
    expect(within(dialog).getByDisplayValue(generated)).toBeInTheDocument();
  });

  it('explains a refusal from the server', async () => {
    mockFetch(403, { error: 'Forbidden' });
    renderList();
    const { user, dialog } = await openDialogFor('ana@test.dev');

    await user.type(within(dialog).getByLabelText('New password'), 'long-enough-1');
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Only admins can do this.');
  });
});
