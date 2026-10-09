import { useTranslations } from 'next-intl';
import { muscleGroupMessageKeys } from '@/i18n/enum-keys';
import type { BodyView, ExerciseMapRegion, ExerciseMuscleRole } from '@/lib/muscle-map';
import { BODY_OUTLINE_PATHS, BODY_VIEWBOX, REGION_PATHS } from '@/components/progress/body-paths';

const ROLE_FILL: Record<ExerciseMuscleRole, string> = {
  primary: 'fill-primary',
  secondary: 'fill-primary/40',
  none: 'fill-muted',
};

// Front and back silhouettes with the exercise's primary and secondary muscles
// (catalog ExerciseMuscle roles, epic 2.7). Our own schematic drawing
// (components/progress/body-paths), shared with the progress heat map. Color
// is never the only cue: each worked region has an accessible label and the
// muscle lists sit next to the figures.
export function ExerciseBodyMap({ regions }: { regions: ExerciseMapRegion[] }) {
  const t = useTranslations('exercises.detail.bodyMap');
  const exerciseT = useTranslations('exercises');

  if (!regions.some((region) => region.role !== 'none')) return null;

  const label = (region: ExerciseMapRegion) =>
    t('regionLabel', {
      name: exerciseT(`muscleGroups.${muscleGroupMessageKeys[region.group]}`),
      role: t(region.role === 'primary' ? 'primary' : 'secondary'),
    });

  const renderView = (view: BodyView) => (
    <figure className="flex flex-col items-center">
      <svg
        viewBox={BODY_VIEWBOX}
        role="group"
        aria-label={t(view)}
        className="h-auto w-full max-w-[140px]"
      >
        {BODY_OUTLINE_PATHS.map((d) => (
          <path key={d} d={d} className="fill-muted/40" />
        ))}
        {regions
          .filter((region) => region.view === view)
          .map((region) =>
            region.role === 'none' ? (
              <path
                key={region.regionId}
                d={REGION_PATHS[view][region.regionId]}
                className={ROLE_FILL.none}
                aria-hidden="true"
              />
            ) : (
              <path
                key={region.regionId}
                d={REGION_PATHS[view][region.regionId]}
                className={`${ROLE_FILL[region.role]} stroke-background`}
                strokeWidth={2}
                role="img"
                aria-label={label(region)}
              >
                <title>{label(region)}</title>
              </path>
            ),
          )}
      </svg>
      <figcaption className="text-xs text-muted-foreground">{t(view)}</figcaption>
    </figure>
  );

  return (
    <div data-testid="exercise-body-map" className="flex flex-col gap-2">
      <div className="flex items-start justify-center gap-4">
        {renderView('front')}
        {renderView('back')}
      </div>
      <div className="flex justify-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
        {(['primary', 'secondary'] as const).map((role) => (
          <span key={role} className="flex items-center gap-1.5">
            <svg viewBox="0 0 12 12" className="size-3">
              <rect width="12" height="12" rx="3" className={ROLE_FILL[role]} />
            </svg>
            {t(role)}
          </span>
        ))}
      </div>
    </div>
  );
}
