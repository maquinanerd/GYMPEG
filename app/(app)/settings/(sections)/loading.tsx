import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Loading shape of a page opened from Perfil: the back link, the title and a
// few labelled fields. Static blocks, no pulse.
export default async function SettingsSectionLoading() {
  const t = await getTranslations('common.actions');
  return (
    <SkeletonScreen
      label={t('loading')}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-7"
    >
      <div className="flex flex-col gap-2 pb-5 pt-2">
        <div className="flex h-11 items-center">
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="flex flex-col gap-5">
        {[0, 1, 2, 3].map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
