'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { clearLocalUserData } from '@/lib/local-data';
import { cn } from '@/lib/utils';

// "Sair desta conta": a full-width 52px outline button at the foot of Perfil.
export function LogoutButton({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      // Local cleanup first: pending sets still need the session to sync.
      await clearLocalUserData().catch(() => undefined);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleLogout}
      loading={isPending}
      disabled={isPending}
      className={cn('h-[3.25rem] w-full text-body font-semibold', className)}
    >
      {label ?? t('logout')}
    </Button>
  );
}
