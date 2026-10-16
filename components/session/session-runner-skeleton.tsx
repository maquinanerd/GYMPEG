import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// The running workout while it loads, in the shapes of the real screen:
// header, progress segments, exercise tabs, the picture, the name, the
// suggestion note, the set rows and the docked footer. Static muted blocks,
// no pulse.
export function SessionRunnerSkeleton({ label }: { label: string }) {
  return (
    <SkeletonScreen label={label} className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl pt-[env(safe-area-inset-top)]">
        <div className="flex h-12 items-center gap-3 px-5">
          <Skeleton className="size-6 rounded-xs" />
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </span>
          <Skeleton className="size-7 rounded-xs" />
        </div>
        <div className="flex gap-[3px] px-5 pt-1.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-[3px] flex-1 rounded-[2px]" />
          ))}
        </div>
        <div className="flex h-12 items-center gap-5 border-b border-border px-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 pt-5">
        <Skeleton className="aspect-[3/2] w-full rounded-md" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full rounded-md" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-t border-border py-1.5">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-12 flex-1 rounded-sm" />
            <Skeleton className="h-12 flex-1 rounded-sm" />
            <Skeleton className="h-12 flex-1 rounded-sm" />
            <Skeleton className="size-16 rounded-full" />
          </div>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <Skeleton className="size-16 rounded-md" />
          <Skeleton className="h-16 flex-1 rounded-md" />
          <Skeleton className="size-16 rounded-md" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
