'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export interface AdminResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

// One admin API call: JSON in and out, the generic errors (no permission,
// too many attempts, network) shown as a toast, and the server-rendered page
// refreshed after a change so it shows the saved state.
export function useAdminRequest() {
  const t = useTranslations('admin.common');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function send<T = unknown>(
    url: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
    { refresh = true }: { refresh?: boolean } = {},
  ): Promise<AdminResponse<T>> {
    setPending(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as T | null;
      if (res.ok) {
        if (refresh) router.refresh();
      } else if (res.status === 403) {
        toast.error(t('forbidden'));
      } else if (res.status === 429) {
        toast.error(t('rateLimited'));
      }
      return { ok: res.ok, status: res.status, data };
    } catch {
      toast.error(t('error'));
      return { ok: false, status: 0, data: null };
    } finally {
      setPending(false);
    }
  }

  return { send, pending };
}
