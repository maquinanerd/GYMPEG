'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SignOutIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { clearLocalUserData } from '@/lib/local-data';

export function LogoutButton() {
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
    <Button variant="secondary" onClick={handleLogout} disabled={isPending} className="w-full">
      <SignOutIcon className="size-4" />
      <span>{t('logout')}</span>
    </Button>
  );
}
