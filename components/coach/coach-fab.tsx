import Link from 'next/link';
import { SparkleIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// The AI entry point: a lime sphere with the soft "shadow-ai" glow, the only
// glow in the app, reserved for content that comes from the AI. Floats above
// the bottom bar on the main screens; in the session runner it sits in the
// header instead (variant "header") and opens the chat with the workout
// attached.
export function CoachFab({
  href = '/coach',
  label,
  variant = 'floating',
  className,
}: {
  href?: string;
  label: string;
  variant?: 'floating' | 'header';
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-ai transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 motion-reduce:transition-none',
        variant === 'floating'
          ? 'fixed bottom-[calc(6.875rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50vw-21rem+1.25rem))] z-30 size-14'
          : 'size-12',
        className,
      )}
    >
      <SparkleIcon className={variant === 'floating' ? 'size-[26px]' : 'size-[22px]'} />
    </Link>
  );
}
