'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Small line chart of the design v2: hairline grid (border), 11px muted axis
// labels, ink lines, no area fill, no gradient. One optional point is marked
// as the record: a pr-yellow dot with a 2px ink ring. Drawn in real pixels
// (the width is measured) so strokes and labels never scale with the screen.

export interface LineSeries {
  // One value per x step, oldest first; every series shares the same steps.
  values: number[];
  // "ink": the main line (2.5px). "raw": the faint line under it (1.5px, the
  // input grey), e.g. each weigh-in under the 7-day average.
  tone: 'ink' | 'raw';
}

const TOP = 20;
const BOTTOM = 24;
const LEFT = 7;
const LABEL_GUTTER = 40;
const FALLBACK_WIDTH = 350;

// Round tick values (1, 2, 2.5, 5 x 10^n steps) covering [min, max].
export function niceTicks(min: number, max: number, count = 3): number[] {
  let lo = min;
  let hi = max;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.02 || 1;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const first = Math.floor(lo / step) * step;
  const last = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= last + step / 2; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return ticks;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function LineChart({
  series,
  label,
  startLabel,
  endLabel,
  highlightIndex,
  formatTick = (value) => String(value),
  height = 150,
  className,
}: {
  series: LineSeries[];
  // Summary read by assistive tech (role="img").
  label: string;
  // Dates under the first and the last step.
  startLabel?: string;
  endLabel?: string;
  // Step of the first series drawn as the record dot.
  highlightIndex?: number;
  formatTick?: (value: number) => string;
  height?: number;
  className?: string;
}) {
  const { ref, width } = useWidth();
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  const steps = Math.max(0, ...series.map((s) => s.values.length));
  const ticks = all.length > 0 ? niceTicks(Math.min(...all), Math.max(...all)) : [];
  const lo = ticks[0] ?? 0;
  const hi = ticks[ticks.length - 1] ?? 1;
  const plotBottom = height - BOTTOM;
  const plotRight = Math.max(LEFT + 1, width - LABEL_GUTTER);
  const x = (i: number) =>
    steps <= 1 ? (LEFT + plotRight) / 2 : LEFT + (i / (steps - 1)) * (plotRight - LEFT);
  const y = (v: number) => TOP + ((hi - v) / (hi - lo || 1)) * (plotBottom - TOP);
  const points = (values: number[]) =>
    values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const highlight =
    highlightIndex != null ? series[0]?.values[highlightIndex] : undefined;

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="block overflow-visible"
      >
        {ticks.map((tick) => (
          <g key={tick} aria-hidden>
            <line x1={0} x2={width} y1={y(tick)} y2={y(tick)} className="stroke-border" />
            <text
              x={width}
              y={y(tick) - 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px] font-medium"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {series.map((s, index) =>
          s.values.length > 1 ? (
            <polyline
              key={index}
              aria-hidden
              points={points(s.values)}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth={s.tone === 'ink' ? 2.5 : 1.5}
              className={s.tone === 'ink' ? 'stroke-ink' : 'stroke-input'}
            />
          ) : null,
        )}
        {/* A lone value has no line to draw: a small ink dot stands in. */}
        {steps === 1 && highlightIndex == null && series[0]?.values[0] != null && (
          <circle
            aria-hidden
            cx={x(0)}
            cy={y(series[0].values[0])}
            r={3.5}
            className="fill-ink"
          />
        )}
        {highlight != null && highlightIndex != null && (
          <circle
            aria-hidden
            data-testid="chart-record"
            cx={x(highlightIndex)}
            cy={y(highlight)}
            r={6}
            strokeWidth={2}
            className="fill-pr stroke-ink"
          />
        )}
        {startLabel && (
          <text
            aria-hidden
            x={0}
            y={height - 6}
            className="fill-muted-foreground text-[11px] font-medium"
          >
            {startLabel}
          </text>
        )}
        {endLabel && steps > 1 && (
          <text
            aria-hidden
            x={plotRight}
            y={height - 6}
            textAnchor="end"
            className="fill-muted-foreground text-[11px] font-medium"
          >
            {endLabel}
          </text>
        )}
      </svg>
    </div>
  );
}
