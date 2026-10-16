import { useTranslations } from 'next-intl';
import type { CompactMuscle } from '@/lib/muscle-map';
import { cn } from '@/lib/utils';

// Compact front/back figure (docs/design/mocks/MuscleMap.dc.html): rounded
// shapes on a 120x116 grid, front on the left and back on the right. Colors
// are the heat tokens only: heat-0 for "off", heat-2 for a muscle the workout
// trains, or the 0..3 level of the weekly heat map when `levels` is given.
// Never color alone: the figure carries a label listing what is lit, and each
// shape names its muscle.

type HeatLevel = 0 | 1 | 2 | 3;

const HEAT_FILL: Record<HeatLevel, string> = {
  0: 'fill-heat-0',
  1: 'fill-heat-1',
  2: 'fill-heat-2',
  3: 'fill-heat-3',
};

type Shape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

const rect = (x: number, y: number, width: number, height: number, rx: number): Shape => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  rx,
});
const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
});

// Geometry of the mock, grouped per muscle (both sides, both views).
const SHAPES: Record<CompactMuscle, Shape[]> = {
  shoulders: [
    ellipse(18.5, 22, 5.5, 5),
    ellipse(41.5, 22, 5.5, 5),
    ellipse(78.5, 22, 5.5, 5),
    ellipse(101.5, 22, 5.5, 5),
  ],
  chest: [rect(21.5, 18, 8, 12, 4), rect(30.5, 18, 8, 12, 4)],
  abs: [rect(23.5, 32, 13, 20, 5)],
  biceps: [rect(12, 28.5, 6.5, 15, 3.25), rect(41.5, 28.5, 6.5, 15, 3.25)],
  forearms: [
    rect(10, 45.5, 5.5, 15, 2.75),
    rect(44.5, 45.5, 5.5, 15, 2.75),
    rect(70, 45.5, 5.5, 15, 2.75),
    rect(104.5, 45.5, 5.5, 15, 2.75),
  ],
  quads: [rect(21.5, 55, 8, 28, 4), rect(30.5, 55, 8, 28, 4)],
  calves: [
    rect(22.5, 86, 6, 24, 3),
    rect(31.5, 86, 6, 24, 3),
    rect(82.5, 86, 6, 24, 3),
    rect(91.5, 86, 6, 24, 3),
  ],
  back: [rect(83, 15.5, 14, 7, 3.5), rect(81.5, 24, 17, 24, 6)],
  triceps: [rect(72, 28.5, 6.5, 15, 3.25), rect(101.5, 28.5, 6.5, 15, 3.25)],
  glutes: [rect(81.5, 50, 8, 12, 4), rect(90.5, 50, 8, 12, 4)],
  hams: [rect(81.5, 64, 8, 19, 4), rect(90.5, 64, 8, 19, 4)],
};

const DRAW_ORDER: CompactMuscle[] = [
  'shoulders',
  'chest',
  'abs',
  'biceps',
  'forearms',
  'quads',
  'calves',
  'back',
  'triceps',
  'glutes',
  'hams',
];

// Legend of the heat scale (heat-0..3): a 14px swatch at radius 3 per level.
// The heat map never goes without it.
export function MuscleMapLegend({ className }: { className?: string }) {
  const t = useTranslations('progress.muscleMap.legend');
  return (
    <ul className={cn('flex flex-col gap-2 text-[0.8125rem] font-medium', className)}>
      {(['none', 'low', 'optimal', 'high'] as const).map((key, level) => (
        <li key={key} className="flex items-center gap-2">
          <span aria-hidden className={cn('size-3.5 rounded-[3px]', HEAT_BG[level as HeatLevel])} />
          {t(key)}
        </li>
      ))}
    </ul>
  );
}

const HEAT_BG: Record<HeatLevel, string> = {
  0: 'bg-heat-0',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
};

function renderShape(shape: Shape, key: number) {
  return shape.kind === 'rect' ? (
    <rect key={key} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />
  ) : (
    <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
  );
}

export function MuscleMap({
  active = [],
  levels,
  size = 120,
  theme = 'light',
  className,
}: {
  // Muscles the workout trains (painted heat-2, or ink on the lime block).
  active?: readonly CompactMuscle[];
  // Weekly heat per muscle; wins over `active` when given.
  levels?: Partial<Record<CompactMuscle, HeatLevel>>;
  // Width in px; the height follows the 120x116 grid.
  size?: number;
  // "lime": drawn on the lime block (ink at 13% off, ink on). Ignored with
  // `levels`, which always reads the heat scale.
  theme?: 'light' | 'lime';
  className?: string;
}) {
  const t = useTranslations('progress.muscleMap');
  const levelOf = (muscle: CompactMuscle): HeatLevel =>
    levels ? (levels[muscle] ?? 0) : active.includes(muscle) ? 2 : 0;
  const onLime = theme === 'lime' && !levels;
  const fillOf = (level: HeatLevel) =>
    onLime ? (level > 0 ? 'fill-ink' : 'fill-ink/[0.13]') : HEAT_FILL[level];
  const lit = DRAW_ORDER.filter((muscle) => levelOf(muscle) > 0);
  const status = (level: HeatLevel) =>
    t(`status.${(['none', 'low', 'optimal', 'high'] as const)[level]}`);
  const label =
    lit.length > 0
      ? t('compact.label', { list: lit.map((muscle) => t(`compact.${muscle}`)).join(', ') })
      : t('compact.none');

  return (
    <svg
      width={size}
      height={Math.round((size * 116) / 120)}
      viewBox="0 0 120 116"
      // role="group", not "img": an img SVG prunes its children from the
      // accessibility tree, which would silence the per-muscle labels.
      role="group"
      aria-label={label}
      className={cn('block shrink-0', className)}
    >
      {/* Heads */}
      <g className={fillOf(0)} aria-hidden>
        <ellipse cx={30} cy={8} rx={5.5} ry={6.5} />
        <ellipse cx={90} cy={8} rx={5.5} ry={6.5} />
      </g>
      {DRAW_ORDER.map((muscle) => {
        const level = levelOf(muscle);
        // With levels every muscle reads its status; otherwise only the lit
        // ones are announced (the figure's label already lists them).
        const announced = levels != null || level > 0;
        return (
          <g
            key={muscle}
            role={announced ? 'img' : undefined}
            aria-hidden={announced ? undefined : true}
            aria-label={
              !announced
                ? undefined
                : levels
                  ? `${t(`compact.${muscle}`)}: ${status(level)}`
                  : t(`compact.${muscle}`)
            }
            className={fillOf(level)}
          >
            {SHAPES[muscle].map(renderShape)}
          </g>
        );
      })}
    </svg>
  );
}
