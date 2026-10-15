import { getTranslations } from 'next-intl/server';
import { ScreenHeader } from '@/components/nav/screen-header';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Evolução while the server loads: the header and the tab row as they are,
// then the Semana tab in its real shapes (static muted blocks, no pulse).
export default async function ProgressLoading() {
  const t = await getTranslations('progress');
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl">
        <ScreenHeader title={t('title')} />
        <SkeletonScreen label={t('loading')}>
          <div className="flex h-11 items-center gap-6 border-b border-border px-5">
            {[56, 56, 48, 72].map((width, index) => (
              <Skeleton key={index} className="h-4" style={{ width }} />
            ))}
          </div>
          <div className="flex flex-col gap-[26px] px-5 pb-7 pt-[18px]">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-48" />
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="mb-2 h-5 w-40" />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="grid min-h-11 grid-cols-[92px_minmax(0,1fr)_72px] items-center gap-2.5"
                >
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3 w-full rounded-[2px]" />
                  <Skeleton className="ml-auto h-3.5 w-14" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-t border-border pt-5">
              <Skeleton className="h-[131px] w-[136px] rounded-sm min-[375px]:h-[174px] min-[375px]:w-[180px]" />
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-4 w-28" />
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-3.5 w-24" />
                ))}
              </div>
            </div>
          </div>
        </SkeletonScreen>
      </div>
    </main>
  );
}
