import { getTranslations } from 'next-intl/server';
import { TrainingHeader } from '@/components/nav/screen-header';
import { Card } from '@/components/ui/card';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Programas while it loads: the active program block, the other programs and
// the template chips in their real shapes (static, no pulse).
export default async function ProgramsLoading() {
  const t = await getTranslations('programs.list');
  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <TrainingHeader />
      <SkeletonScreen label={t('loading')} className="flex flex-col gap-7 px-5 pb-7 pt-5">
        <Card className="flex flex-col gap-3.5 px-4 pb-1.5 pt-[18px]">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Skeleton className="h-2 w-full rounded-[2px]" />
          <ul>
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="flex min-h-14 items-center gap-3 border-t border-border">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3 w-20" />
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex min-h-16 flex-col justify-center gap-1.5 border-t border-border">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[56, 64, 64, 52, 96].map((width, index) => (
            <Skeleton key={index} className="h-10 rounded-sm" style={{ width }} />
          ))}
        </div>
      </SkeletonScreen>
    </main>
  );
}
