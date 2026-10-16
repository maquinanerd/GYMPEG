'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CircleNotchIcon, FloppyDiskIcon, TrashIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SecretView } from '@/lib/admin-config';
import type { SecretKey } from '@/lib/admin-settings';
import { useAdminRequest } from './use-admin-request';

// An API key: where the one in use comes from, a field to paste a new one and
// a button to remove the panel's. A saved key is never shown again, only its
// last 4 characters.
export function SecretField({
  secretKey,
  label,
  view,
}: {
  secretKey: SecretKey;
  label: string;
  view: SecretView;
}) {
  const t = useTranslations('admin.secret');
  const common = useTranslations('admin.common');
  const { send, pending } = useAdminRequest();
  const [value, setValue] = useState('');
  const id = `secret-${secretKey}`;

  const status = view.panel
    ? view.panel.readable
      ? t('panel', { last4: view.panel.last4 })
      : t('unreadable')
    : view.envConfigured
      ? t('env')
      : t('none');

  async function save(next: string | null) {
    const res = await send('/api/admin/secrets', 'PUT', { key: secretKey, value: next });
    if (res.ok) {
      setValue('');
      toast.success(next === null ? t('removed') : t('saved'));
    } else if (res.status === 400) {
      toast.error(t('invalid'));
    } else if (res.status !== 403 && res.status !== 429) {
      toast.error(common('error'));
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <p
        className={
          view.panel && !view.panel.readable
            ? 'text-sm text-destructive'
            : 'text-sm text-muted-foreground'
        }
      >
        {status}
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save(value.trim());
        }}
      >
        <Input
          id={id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('placeholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 font-mono"
        />
        <Button type="submit" size="sm" disabled={pending || value.trim().length < 8}>
          {pending ? (
            <CircleNotchIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <FloppyDiskIcon aria-hidden="true" />
          )}
          {common('save')}
        </Button>
        {view.panel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void save(null)}
          >
            <TrashIcon aria-hidden="true" />
            {common('remove')}
          </Button>
        )}
      </form>
    </div>
  );
}
