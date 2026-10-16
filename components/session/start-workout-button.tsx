'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { startSession } from '@/lib/session-lifecycle';
import { offlineAwareHref } from '@/lib/offline-navigation';
import { cn } from '@/lib/utils';

export function StartWorkoutButton({
  workoutId,
  gymId,
  disabled,
  label,
  variant = 'primary',
  size = 'default',
  className,
  describedBy,
}: {
  workoutId: string;
  gymId?: string | null;
  disabled?: boolean;
  // Defaults to "Iniciar este treino".
  label?: string;
  // "ink" on the lime block of the home, "outline" in a list of workouts.
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  // Id of the element naming the workout, so a list of identical buttons
  // still tells which workout each one starts.
  describedBy?: string;
}) {
  const t = useTranslations('session');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      try {
        const started = await startSession({ workoutId, gymId: gymId ?? null });
        const path = `/session/${started.id}`;
        if (started.synced && navigator.onLine) {
          router.push(path);
          router.refresh();
        } else {
          // Offline: the offline page (precached) runs the session from the
          // device; online but not synced yet, the server page does.
          window.location.assign(offlineAwareHref(path));
        }
      } catch {
        toast.error(t('startError'));
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleStart}
      disabled={disabled}
      // Keeps the label and adds the spinner; blocks a second tap.
      loading={isPending}
      aria-describedby={describedBy}
      className={cn('w-full', className)}
    >
      {label ?? t('startThis')}
    </Button>
  );
}
