import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { clearDeletedAccountData } = vi.hoisted(() => ({
  clearDeletedAccountData: vi.fn(async () => undefined),
}));
vi.mock('@/lib/local-data', () => ({ clearDeletedAccountData }));
vi.mock('@/lib/outbox-owner', () => ({ getOutboxOwner: () => 'user-1' }));

import { PrivacySection } from './privacy-section';

const assign = vi.fn();

beforeEach(() => {
  clearDeletedAccountData.mockClear();
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => vi.unstubAllGlobals());

function stubDelete(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openAndFill(password: string, email: string) {
  const user = userEvent.setup();
  render(<PrivacySection email="lifter@test.dev" />);
  await user.click(screen.getByRole('button', { name: 'Delete my account' }));
  await user.type(screen.getByLabelText('Current password'), password);
  await user.type(screen.getByLabelText('Type your e-mail (lifter@test.dev) to confirm'), email);
  await user.click(screen.getByRole('button', { name: 'Delete everything' }));
}

describe('PrivacySection', () => {
  it('offers the data export as a download', () => {
    render(<PrivacySection email="lifter@test.dev" />);

    expect(screen.getByRole('link', { name: 'Download my data (ZIP)' })).toHaveAttribute(
      'href',
      '/api/account/export',
    );
  });

  it('erases the account, clears this device and leaves for the login', async () => {
    const fetchMock = stubDelete(200, { ok: true });

    await openAndFill('secret-pass', 'LIFTER@test.dev');

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login?deleted=1'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/delete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret-pass', confirmEmail: 'LIFTER@test.dev' }),
      }),
    );
    expect(clearDeletedAccountData).toHaveBeenCalledWith('user-1');
  });

  it('does not call the server when the typed e-mail is not the account’s', async () => {
    const fetchMock = stubDelete(200);

    await openAndFill('secret-pass', 'other@test.dev');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The e-mail does not match your account.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says when the password is wrong and keeps the account', async () => {
    stubDelete(400, { error: 'Current password is incorrect.' });

    await openAndFill('wrong', 'lifter@test.dev');

    expect(await screen.findByRole('alert')).toHaveTextContent('The password is incorrect.');
    expect(assign).not.toHaveBeenCalled();
    expect(clearDeletedAccountData).not.toHaveBeenCalled();
  });
});
