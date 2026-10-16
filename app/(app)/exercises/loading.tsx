import { getTranslations } from 'next-intl/server';
import { TrainingHeader } from '@/components/nav/screen-header';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Exercícios while the catalog loads: the search field, the chips, the count
// and rows in their real shapes (static, no pulse).
export default async function ExercisesLoading() {
  const t = await getTranslations('exercises.list');
  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <TrainingHeader />
      <SkeletonScreen label={t('loading')} className="flex flex-col">
        <div className="flex flex-col gap-3 px-5 pt-4">
          <Skeleton className="h-12 rounded-md" />
          <div className="flex gap-2 overflow-hidden">
            {[64, 72, 72, 72, 80, 72].map((width, index) => (
              <Skeleton key={index} className="h-10 shrink-0 rounded-sm" style={{ width }} />
            ))}
          </div>
          <Skeleton className="my-3.5 h-4 w-44" />
        </div>
        <ul className="px-5 pt-1.5">
          {Array.from({ length: 8 }, (_, index) => (
            <li
              key={index}
              className="grid min-h-[4.25rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-t border-border py-2.5"
            >
              <Skeleton className="size-[52px] rounded-sm" />
              <span className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </span>
            </li>
          ))}
        </ul>
      </SkeletonScreen>
    </main>
  );
}
