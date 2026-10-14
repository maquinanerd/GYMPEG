'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { CircleNotchIcon, TrashIcon } from '@/components/ui/icon';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Props {
  sessionId: string;
  workoutName: string | null;
  startedAt: Date;
}

export function DeleteSessionButton({ sessionId, workoutName, startedAt }: Props) {
  const t = useTranslations('history.delete');
  const common = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const formatted = format.dateTime(startedAt, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  async function handleDelete() {
    setPending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success(t('deleted'));
      router.push('/history');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('error'));
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon className="size-4" />
          <span className="ml-1">{t('button')}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('description', { name: workoutName ?? t('free'), date: formatted })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{common('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                <span className="ml-2">{t('deleting')}</span>
              </>
            ) : (
              t('confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
