import { useTranslations } from 'next-intl';
import { trackDecoupling } from '@/lib/cardio';
import type { TrackPoint } from '@/lib/import/track';
import { Num } from '@/components/ui/num';

// Threshold (in percent) under which the pace-per-heartbeat efficiency is
// considered to have held steady. ~5% is the commonly used cutoff for a
// well-paced aerobic effort.
const STEADY_THRESHOLD_PCT = 5;

// Aerobic decoupling readout for an imported cardio set (issue #268): one
// percentage plus a plain-language explainer, shown only when the stored
// track carries both cumulative distance and heart rate (trackDecoupling
// returns null otherwise, and this renders nothing).
export function TrackDecoupling({ track }: { track: TrackPoint[] }) {
  const t = useTranslations('history.detail');
  const decoupling = trackDecoupling(track);
  if (decoupling == null) return null;

  const held = decoupling <= STEADY_THRESHOLD_PCT;
  return (
    <div className="mt-3 flex flex-col gap-0.5" data-testid="track-decoupling">
      <p className="text-small font-semibold text-muted-foreground">{t('decouplingTitle')}</p>
      <p className="text-[0.8125rem] text-muted-foreground">
        <Num stretch={112} className="mr-2 text-caption text-foreground">
          {decoupling.toFixed(1)}%
        </Num>
        <span>{held ? t('decouplingHeld') : t('decouplingFaded')}</span>
      </p>
    </div>
  );
}
