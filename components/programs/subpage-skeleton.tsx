import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Loading shape of a page under Programas (SubpageHeader + a form or list):
// static muted blocks, no pulse.
export function SubpageSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <SkeletonScreen label={label} className="flex flex-col">
        <div className="flex h-14 items-center px-2 pt-2">
          <Skeleton className="ml-3 size-6 rounded-xs" />
        </div>
        <div className="flex flex-col gap-6 px-5 pb-8 pt-1">
          <Skeleton className="h-9 w-3/5" />
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 rounded-md" />
            </div>
          ))}
        </div>
      </SkeletonScreen>
    </main>
  );
}
