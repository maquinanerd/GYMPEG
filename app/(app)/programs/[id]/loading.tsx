import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// A program while it loads: the header, the workout title with its figure and
// the numbered exercise rows in their real shapes (static, no pulse).
export default async function ProgramLoading() {
  const t = await getTranslations('programs.detail');
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <SkeletonScreen label={t('loading')} className="flex flex-col">
        <div className="flex h-14 items-center gap-1 px-2 pt-2">
          <Skeleton className="ml-3 size-6 rounded-xs" />
          <Skeleton className="ml-3 h-4 w-40" />
        </div>
        <div className="flex flex-col gap-[22px] px-5 pb-6 pt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="h-[101px] w-[104px] rounded-sm" />
          </div>
          <ol>
            {Array.from({ length: 5 }, (_, index) => (
              <li
                key={index}
                className="grid grid-cols-[2rem_auto_minmax(0,1fr)] items-start gap-3 border-b border-border py-3"
              >
                <Skeleton className="h-5 w-5" />
                <Skeleton className="size-12 rounded-sm min-[375px]:size-16" />
                <span className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </SkeletonScreen>
    </main>
  );
}
