'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { startSession } from '@/lib/session-lifecycle';
import { offlineAwareHref } from '@/lib/offline-navigation';

export function StartWorkoutButton({
  workoutId,
  gymId,
  disabled,
}: {
  workoutId: string;
  gymId?: string | null;
  disabled?: boolean;
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
      onClick={handleStart}
      disabled={disabled || isPending}
      className="min-h-tap w-full text-base"
    >
      <Play className="size-5" />
      <span className="ml-2">{isPending ? t('starting') : t('startThis')}</span>
    </Button>
  );
}
