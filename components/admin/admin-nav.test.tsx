import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminNav } from './admin-nav';

let pathname = '/admin';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

afterEach(() => {
  pathname = '/admin';
});

describe('AdminNav', () => {
  it('links the five sections as tabs, the overview selected on /admin only', () => {
    render(<AdminNav />);
    expect(screen.getByRole('tablist', { name: 'Admin sections' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Accounts',
      'AI',
      'E-mail',
      'Audit',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/users',
      '/admin/ai',
      '/admin/email',
      '/admin/audit',
    ]);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('tab', { name: 'Accounts' })).toHaveAttribute('aria-selected', 'false');
  });

  it('selects the section of a nested path, not the overview', () => {
    pathname = '/admin/ai';
    render(<AdminNav />);
    expect(screen.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
  });
});
