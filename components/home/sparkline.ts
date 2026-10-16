// Geometry of the bodyweight sparkline on the home screen: weigh-ins placed
// by date along the x axis, the kg on a y axis that never zooms below
// MIN_SPAN_KG (so a 0.1 kg wobble does not read as a cliff). Pure: the view
// draws the result as an SVG polyline with a dot on the latest point.

export interface SparkPoint {
  at: Date;
  kg: number;
}

export interface Sparkline {
  // "x,y x,y ..." for <polyline points>.
  points: string;
  end: { x: number; y: number };
}

// Smallest kg range the height stands for.
export const MIN_SPAN_KG = 0.6;

export function sparkline(
  series: readonly SparkPoint[],
  { width, height, inset = 3 }: { width: number; height: number; inset?: number },
): Sparkline | null {
  if (series.length < 2) return null;
  const sorted = [...series].sort((a, b) => a.at.getTime() - b.at.getTime());
  const first = sorted[0]!.at.getTime();
  const last = sorted.at(-1)!.at.getTime();
  const timeSpan = last - first;
  const kgs = sorted.map((point) => point.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = Math.max(max - min, MIN_SPAN_KG);
  // Center the data when the floor span is wider than the data's own range.
  const top = (max + min) / 2 + span / 2;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;

  const coords = sorted.map((point, index) => {
    const ratio =
      timeSpan > 0 ? (point.at.getTime() - first) / timeSpan : index / (sorted.length - 1);
    return {
      x: Number((inset + ratio * innerW).toFixed(1)),
      y: Number((inset + ((top - point.kg) / span) * innerH).toFixed(1)),
    };
  });
  return {
    points: coords.map(({ x, y }) => `${x},${y}`).join(' '),
    end: coords.at(-1)!,
  };
}
