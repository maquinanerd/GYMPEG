import { useTranslations } from 'next-intl';
import { Skeleton, SkeletonScreen } from '@/components/ui/skeleton';

// Loading state of the home in the shapes of the real screen: header, the
// lime block (its own fill, so the page does not flash grey to lime), the
// week strip with its two numbers, and two record rows. Static, no pulse.
export function HomeSkeleton() {
  const t = useTranslations('dashboard.home');
  return (
    <SkeletonScreen
      label={t('loading')}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-7"
    >
      <div className="flex items-end justify-between gap-3 px-5 pb-[18px] pt-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-7 w-16" />
      </div>
      <div className="flex flex-col gap-3.5 bg-primary p-5 pb-3.5">
        <Skeleton className="h-4 w-32 bg-ink/[0.13]" />
        <Skeleton className="h-[70px] w-48 bg-ink/[0.13]" />
        <div className="flex flex-col">
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="border-t border-ink/[0.14] py-3">
              <Skeleton className="h-4 w-2/3 bg-ink/[0.13]" />
            </span>
          ))}
        </div>
        <Skeleton className="h-btn w-full rounded-md bg-ink/[0.13]" />
        <Skeleton className="h-5 w-40 bg-ink/[0.13]" />
      </div>
      <div className="flex flex-col gap-3.5 px-5 pt-7">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-7 gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <span key={day} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-3.5 w-6" />
              <Skeleton className="h-[38px] w-full rounded-[6px]" />
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6 pt-1.5">
          {[0, 1].map((cell) => (
            <span key={cell} className="flex flex-col gap-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-1 w-full rounded-[2px]" />
            </span>
          ))}
        </div>
      </div>
      <div className="mx-5 mt-7 flex flex-col gap-1.5">
        <Skeleton className="h-6 w-44" />
        {[0, 1].map((row) => (
          <span key={row} className="flex items-center justify-between gap-3 border-t border-border py-3.5">
            <span className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </span>
            <Skeleton className="h-6 w-16" />
          </span>
        ))}
      </div>
    </SkeletonScreen>
  );
}

// Fallback of any other screen of the app without a loading state of its
// own: a title and a few hairline rows.
export function ScreenSkeleton() {
  const t = useTranslations('dashboard.home');
  return (
    <SkeletonScreen
      label={t('loadingScreen')}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 pb-7 pt-4"
    >
      <Skeleton className="h-9 w-40" />
      <div className="flex flex-col">
        {[0, 1, 2, 3].map((row) => (
          <span key={row} className="flex flex-col gap-1.5 border-t border-border py-3.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </span>
        ))}
      </div>
    </SkeletonScreen>
  );
}
