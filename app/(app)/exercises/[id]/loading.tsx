import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// An exercise page while it loads: back button, title, actions and the facts
// list in their real shapes (static, no pulse).
export default async function ExerciseLoading() {
  const t = await getTranslations('exercises.detail');
  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <SkeletonScreen label={t('loading')} className="flex flex-col">
        <div className="flex h-14 items-center gap-1 px-2 pt-2">
          <Skeleton className="ml-3 size-6 rounded-xs" />
          <Skeleton className="ml-3 h-4 w-24" />
        </div>
        <div className="flex flex-col gap-7 px-5 pb-8 pt-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
            <div className="mt-1 flex gap-2">
              <Skeleton className="h-10 w-28 rounded-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <Skeleton className="h-5 w-48" />
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex justify-between border-t border-border py-3 first:border-t-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </SkeletonScreen>
    </main>
  );
}
