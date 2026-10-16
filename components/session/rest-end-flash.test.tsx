import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { REST_END_FLASH_MS, RestEndFlash } from '@/components/session/rest-end-flash';

afterEach(() => {
  vi.useRealTimers();
});

describe('RestEndFlash (issue #393)', () => {
  it('renders nothing until a rest has run out', () => {
    render(<RestEndFlash count={0} />);
    expect(screen.queryByTestId('rest-end-flash')).not.toBeInTheDocument();
  });

  it('flashes once per bump, then unmounts', () => {
    vi.useFakeTimers();
    const { rerender } = render(<RestEndFlash count={0} />);

    rerender(<RestEndFlash count={1} />);
    const overlay = screen.getByTestId('rest-end-flash');
    // A click-through lime layer over the whole screen, still at rest under
    // reduced motion (no fade there).
    expect(REST_END_FLASH_MS).toBe(300);
    expect(overlay).toHaveClass(
      'bg-primary',
      'pointer-events-none',
      'motion-reduce:transition-none',
    );
    expect(overlay).toHaveAttribute('aria-hidden', 'true');

    act(() => {
      vi.advanceTimersByTime(REST_END_FLASH_MS);
    });
    expect(screen.queryByTestId('rest-end-flash')).not.toBeInTheDocument();

    rerender(<RestEndFlash count={2} />);
    expect(screen.getByTestId('rest-end-flash')).toBeInTheDocument();
  });
});
