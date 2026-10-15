import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressTabs } from './progress-tabs';
import { parseProgressTab } from './progress-tab-keys';

const panels = {
  week: <p>week panel</p>,
  training: <p>training panel</p>,
  body: <p>body panel</p>,
  records: <p>records panel</p>,
};

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('ProgressTabs', () => {
  it('shows the selected panel only and links tabs to panels', () => {
    render(<ProgressTabs initialTab="body" panels={panels} />);
    const tab = screen.getByRole('tab', { name: 'Body' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Body' })).toHaveTextContent('body panel');
    expect(screen.getByText('week panel')).not.toBeVisible();
  });

  it('switches panels and keeps the tab in the URL', async () => {
    const user = userEvent.setup();
    render(<ProgressTabs initialTab="week" panels={panels} />);
    await user.click(screen.getByRole('tab', { name: 'Records' }));
    expect(screen.getByText('records panel')).toBeVisible();
    expect(window.location.search).toBe('?tab=records');

    await user.click(screen.getByRole('tab', { name: 'Week' }));
    expect(window.location.search).toBe('');
  });

  it('falls back to the week tab on an unknown param', () => {
    expect(parseProgressTab('nope')).toBe('week');
    expect(parseProgressTab(undefined)).toBe('week');
    expect(parseProgressTab('training')).toBe('training');
  });
});
