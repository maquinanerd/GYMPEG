import { getTranslations } from 'next-intl/server';
import { TrainingHeader } from '@/components/nav/screen-header';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Histórico while it loads: the month grid, the filter chips and the sessions
// list in their real shapes (static, no pulse).
export default async function HistoryLoading() {
  const t = await getTranslations('history');
  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <TrainingHeader />
      <SkeletonScreen label={t('loading')} className="flex flex-col gap-5 px-5 pb-7 pt-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex h-11 items-center justify-between">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, index) => (
              <Skeleton key={index} className="h-10 rounded-[6px]" />
            ))}
          </div>
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[88, 92, 92, 92, 80].map((width, index) => (
            <Skeleton key={index} className="h-10 shrink-0 rounded-sm" style={{ width }} />
          ))}
        </div>
        <ul>
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="flex flex-col gap-1.5 border-t border-border py-3.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="ml-[4.125rem] h-3 w-2/5" />
            </li>
          ))}
        </ul>
      </SkeletonScreen>
    </main>
  );
}
