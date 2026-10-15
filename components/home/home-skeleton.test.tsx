import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeSkeleton, ScreenSkeleton } from './home-skeleton';

describe('HomeSkeleton', () => {
  it('announces the load once and draws static blocks in the shape of the home', () => {
    const { container } = render(<HomeSkeleton />);
    const status = screen.getByRole('status', { name: 'Loading the home screen' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    // The lime block keeps its fill while loading; the week strip has 7 days.
    expect(container.querySelector('.bg-primary')).not.toBeNull();
    expect(container.querySelectorAll('.h-\\[38px\\]')).toHaveLength(7);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('falls back to a neutral skeleton on other screens', () => {
    render(<ScreenSkeleton />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});
