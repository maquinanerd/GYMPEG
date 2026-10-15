import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineChart, niceTicks } from './line-chart';

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    expect(niceTicks(86, 94)).toEqual([85, 90, 95]);
    expect(niceTicks(78.0, 78.6)).toEqual([78, 78.5, 79]);
  });

  it('opens up a flat series instead of dividing by zero', () => {
    const ticks = niceTicks(50, 50);
    expect(ticks[0]).toBeLessThan(50);
    expect(ticks.at(-1)).toBeGreaterThan(50);
  });
});

describe('LineChart', () => {
  it('draws ink and raw lines, no area, and marks the record point', () => {
    render(
      <LineChart
        label="Estimated 1RM from 86 to 94 kg"
        series={[
          { values: [86, 88, 94], tone: 'ink' },
          { values: [85, 87, 90], tone: 'raw' },
        ]}
        highlightIndex={2}
        startLabel="31/08"
        endLabel="02/10"
      />,
    );
    const chart = screen.getByRole('img', { name: 'Estimated 1RM from 86 to 94 kg' });
    const lines = chart.querySelectorAll('polyline');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveClass('stroke-ink');
    expect(lines[0]).toHaveAttribute('stroke-width', '2.5');
    expect(lines[1]).toHaveClass('stroke-input');
    lines.forEach((line) => expect(line).toHaveAttribute('fill', 'none'));
    expect(chart.querySelector('path, linearGradient')).toBeNull();
    expect(screen.getByTestId('chart-record')).toHaveClass('fill-pr', 'stroke-ink');
    expect(chart).toHaveTextContent('31/08');
    expect(chart).toHaveTextContent('02/10');
  });
});
