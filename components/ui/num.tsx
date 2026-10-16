import { cn } from '@/lib/utils';

const STRETCH = {
  100: 'stretch-100',
  108: 'stretch-108',
  112: 'stretch-112',
  118: 'stretch-118',
  125: 'stretch-125',
} as const;

export type NumStretch = keyof typeof STRETCH;

// A number the app calculated or the user logged (load, reps, time, volume,
// dates of the sheet): Archivo widened like the figures stamped on a plate,
// 600, tabular so live values do not jump. Never italic (italic is the AI).
export function Num({
  stretch = 125,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { stretch?: NumStretch }) {
  return (
    <span
      className={cn('font-num font-semibold not-italic tabular-nums', STRETCH[stretch], className)}
      {...props}
    />
  );
}
