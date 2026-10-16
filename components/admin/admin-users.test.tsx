import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserRow } from '@/lib/admin';
import { AdminUsers } from './admin-users';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { toast } from 'sonner';

// Radix Switch measures itself; jsdom has no ResizeObserver.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

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
    blocked: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    lastSeenAt: '2026-10-14T10:00:00.000Z',
  },
  {
    id: 'user-2',
    email: 'ana@test.dev',
    displayName: null,
    role: 'USER',
    blocked: false,
    createdAt: '2026-10-02T10:00:00.000Z',
    lastSeenAt: null,
  },
  {
    id: 'user-3',
    email: 'bia@test.dev',
    displayName: null,
    role: 'USER',
    blocked: true,
    createdAt: '2026-10-03T10:00:00.000Z',
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
  return userEvent.setup();
}

async function pick(user: ReturnType<typeof userEvent.setup>, email: string, action: string) {
  await user.click(screen.getByRole('button', { name: `Actions for ${email}` }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
}

describe('AdminUsers', () => {
  it('lists every account, marks blocked ones and offers no actions on the admin’s own row', () => {
    renderList();
    expect(screen.getByText('3 accounts')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Actions for admin@test.dev' }),
    ).not.toBeInTheDocument();
  });

  it('checks the password length before calling the API', async () => {
    const fetchFn = mockFetch(200, {});
    const user = renderList();
    await pick(user, 'ana@test.dev', 'Set password');
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('New password'), 'short');
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sets a generated password and shows it to hand over', async () => {
    const fetchFn = mockFetch(200, { ok: true, signedOutSessions: 1 });
    const user = renderList();
    await pick(user, 'ana@test.dev', 'Set password');
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Generate' }));
    const generated = (within(dialog).getByLabelText('New password') as HTMLInputElement).value;
    expect(generated).toHaveLength(14);
    await user.click(within(dialog).getByRole('button', { name: 'Set password' }));

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/admin/users/user-2/password',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)).toEqual({ password: generated });
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Password set. 1 device was signed out.',
    );
    expect(within(dialog).getByDisplayValue(generated)).toBeInTheDocument();
  });

  it('creates an account, as admin when switched on', async () => {
    const fetchFn = mockFetch(201, { ok: true, id: 'new-id' });
    const user = renderList();
    await user.click(screen.getByRole('button', { name: 'New account' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('E-mail'), 'carla@test.dev');
    await user.type(within(dialog).getByLabelText('New password'), 'carla-password');
    await user.click(within(dialog).getByRole('switch', { name: 'Admin' }));
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(fetchFn).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)).toEqual({
      email: 'carla@test.dev',
      password: 'carla-password',
      displayName: null,
      role: 'ADMIN',
    });
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'Account created for carla@test.dev.',
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('says so when the e-mail already has an account', async () => {
    mockFetch(409, { error: 'exists' });
    const user = renderList();
    await user.click(screen.getByRole('button', { name: 'New account' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('E-mail'), 'ana@test.dev');
    await user.type(within(dialog).getByLabelText('New password'), 'some-password');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'There is already an account with this e-mail.',
    );
  });

  it('blocks after a confirmation, and offers unblock on a blocked account', async () => {
    const fetchFn = mockFetch(200, { ok: true });
    const user = renderList();
    await pick(user, 'ana@test.dev', 'Block');
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('ana@test.dev is signed out on every device');
    await user.click(within(confirm).getByRole('button', { name: 'Block' }));

    expect(fetchFn).toHaveBeenCalledWith('/api/admin/users/user-2', expect.objectContaining({ method: 'PATCH' }));
    expect(JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)).toEqual({ blocked: true });
    expect(toast.success).toHaveBeenCalledWith('ana@test.dev is blocked.');

    await user.click(screen.getByRole('button', { name: 'Actions for bia@test.dev' }));
    expect(await screen.findByRole('menuitem', { name: 'Unblock' })).toBeInTheDocument();
  });

  it('deletes only once the e-mail is retyped exactly', async () => {
    const fetchFn = mockFetch(200, { ok: true });
    const user = renderList();
    await pick(user, 'ana@test.dev', 'Delete account');
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete forever' });

    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type the account e-mail to confirm'), 'ana@test.de');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type the account e-mail to confirm'), 'v');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(fetchFn).toHaveBeenCalledWith('/api/admin/users/user-2', expect.objectContaining({ method: 'DELETE' }));
    expect(JSON.parse(fetchFn.mock.calls[0]![1]!.body as string)).toEqual({
      confirmEmail: 'ana@test.dev',
    });
    expect(toast.success).toHaveBeenCalledWith('ana@test.dev was deleted.');
  });
});
