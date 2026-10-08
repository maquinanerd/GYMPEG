'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
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
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={isPending}
      aria-label={t('logout')}
    >
      <LogOut className="size-4" />
      <span className="ml-2 hidden sm:inline">{t('logout')}</span>
    </Button>
  );
}
