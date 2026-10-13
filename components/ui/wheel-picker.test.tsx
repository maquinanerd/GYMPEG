import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WheelPicker } from './wheel-picker';

const OPTIONS = [0, 1, 2, 3].map((value) => ({ value, label: String(value) }));

describe('WheelPicker', () => {
  it('is a labelled listbox with the current value selected', () => {
    render(<WheelPicker options={OPTIONS} value={2} onChange={vi.fn()} label="RIR" />);
    const list = screen.getByRole('listbox', { name: 'RIR' });
    expect(screen.getByRole('option', { name: '2' })).toHaveAttribute('aria-selected', 'true');
    expect(list).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: '2' }).id,
    );
  });

  it('steps with the arrow keys and stops at the ends', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <WheelPicker options={OPTIONS} value={2} onChange={onChange} label="RIR" />,
    );
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(3);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(1);

    onChange.mockClear();
    rerender(<WheelPicker options={OPTIONS} value={3} onChange={onChange} label="RIR" />);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('picks a tapped row', () => {
    const onChange = vi.fn();
    render(<WheelPicker options={OPTIONS} value={0} onChange={onChange} label="RIR" />);
    fireEvent.click(screen.getByRole('option', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
