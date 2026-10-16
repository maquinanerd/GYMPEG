'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SecretView } from '@/lib/admin-config';
import type { SecretKey } from '@/lib/admin-settings';
import { cn } from '@/lib/utils';
import { FIELD, HINT, INLINE_FORM, INLINE_INPUT, LABEL } from './admin-ui';
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
    <div className={FIELD}>
      <Label htmlFor={id} className={LABEL}>
        {label}
      </Label>
      <p className={cn(HINT, view.panel && !view.panel.readable && 'text-destructive-text')}>
        {status}
      </p>
      <form
        className={INLINE_FORM}
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
          className={INLINE_INPUT}
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="ink"
            loading={pending}
            disabled={pending || value.trim().length < 8}
            className="h-12"
          >
            {common('save')}
          </Button>
          {view.panel && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => void save(null)}
              className="h-12"
            >
              {common('remove')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
