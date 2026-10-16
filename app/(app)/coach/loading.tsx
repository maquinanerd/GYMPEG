import { getTranslations } from 'next-intl/server';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Loading shape of the coach: header, the two tabs, a coach turn, a lifter
// bubble and the docked composer. Static blocks, no pulse.
export default async function CoachLoading() {
  const t = await getTranslations('common.actions');
  return (
    <SkeletonScreen label={t('loading')} className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col gap-2 px-5 pb-2 pt-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex h-11 items-center gap-6 border-b border-border px-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-[18px] px-5 pt-[18px]">
        <div className="flex w-[85%] flex-col gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-16 w-3/5 self-end rounded-[12px_12px_4px_12px]" />
      </div>
      <div className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-5 pb-3 pt-2">
          <div className="flex gap-2 overflow-hidden">
            <Skeleton className="h-9 w-48 shrink-0 rounded-sm" />
            <Skeleton className="h-9 w-36 shrink-0 rounded-sm" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-12 flex-1 rounded-md" />
            <Skeleton className="size-12 rounded-md" />
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}
