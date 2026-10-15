import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Loading shape of Perfil: the avatar and name, then groups of rows. Static
// blocks, no pulse.
export default async function SettingsLoading() {
  const t = await getTranslations('common.actions');
  return (
    <SkeletonScreen
      label={t('loading')}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-5 pb-7 pt-4"
    >
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      {[3, 3, 3, 3].map((rows, group) => (
        <div key={group} className="flex flex-col">
          <Skeleton className="mb-2 h-4 w-24" />
          {Array.from({ length: rows }, (_, row) => (
            <div
              key={row}
              className="flex min-h-[3.25rem] items-center justify-between gap-3 border-t border-border"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ))}
    </SkeletonScreen>
  );
}
