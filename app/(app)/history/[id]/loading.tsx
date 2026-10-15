import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// A past session while it loads: title, summary and one set sheet in their
// real shapes (static, no pulse).
export default async function HistorySessionLoading() {
  const t = await getTranslations('history');
  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <SkeletonScreen label={t('loading')} className="flex flex-col">
        <div className="flex h-14 items-center gap-1 px-2 pt-2">
          <Skeleton className="ml-3 size-6 rounded-xs" />
          <Skeleton className="ml-3 h-4 w-28" />
        </div>
        <div className="flex flex-col gap-6 px-5 pb-8 pt-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          {Array.from({ length: 2 }, (_, block) => (
            <div key={block} className="flex flex-col gap-2 border-t border-border pt-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-2/5" />
              {Array.from({ length: 4 }, (_, row) => (
                <Skeleton key={row} className="h-9 w-full rounded-none border-b border-border" />
              ))}
            </div>
          ))}
        </div>
      </SkeletonScreen>
    </main>
  );
}
