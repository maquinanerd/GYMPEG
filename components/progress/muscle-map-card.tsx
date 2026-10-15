import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { compactHeat, type MuscleMapRegion } from '@/lib/muscle-map';
import { MuscleMap, MuscleMapLegend } from '@/components/progress/muscle-map';

interface Props {
  regions: MuscleMapRegion[];
  // Preformatted label of the week the map describes (same week as the
  // sets-per-muscle rows).
  weekLabel: string;
}

// "Mapa da semana" (issue #299, Semana tab): the compact front/back figure
// tinted by this week's working sets against each muscle's MEV/MRV band, with
// the heat legend beside it. Identity is never color alone: every shape reads
// its muscle and status, and the legend names the four levels.
export function MuscleMapCard({ regions, weekLabel }: Props) {
  const t = useTranslations('progress.muscleMap');
  const headingId = useId();
  const trained = regions.some((r) => r.level !== 'none');

  return (
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-t border-border pt-5 min-[375px]:gap-[18px]"
    >
      <MuscleMap
        levels={compactHeat(regions)}
        size={180}
        className="h-auto w-[136px] min-[375px]:w-[180px]"
      />
      <div className="flex flex-col gap-2.5">
        <h2 id={headingId} className="text-subtitle">
          {t('title')}
        </h2>
        <MuscleMapLegend />
        <p className="text-small text-muted-foreground" data-testid="muscle-map-detail">
          {trained ? weekLabel : t('empty')}
        </p>
      </div>
    </section>
  );
}
