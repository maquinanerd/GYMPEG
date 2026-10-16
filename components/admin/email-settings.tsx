'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag } from '@/components/ui/tag';
import type { AdminConfigView, EmailTest } from '@/lib/admin-config';
import { EMAIL_PROVIDER_VALUES } from '@/lib/admin-settings';
import { cn } from '@/lib/utils';
import { DESCRIPTION, FIELD, HINT, LABEL } from './admin-ui';
import { SecretField } from './secret-field';
import { useAdminRequest } from './use-admin-request';

const SERVER_DEFAULT = '__server__';

interface Props {
  view: AdminConfigView;
  available: boolean;
  appUrl: string | null;
  adminEmail: string;
}

// E-mail for password reset links: Resend with a verified sender domain.
// Two sections on the page: whether reset works (a tag) with a test send,
// then the provider, sender and key.
export function EmailSettings({ view, available, appUrl, adminEmail }: Props) {
  const t = useTranslations('admin.email');
  const common = useTranslations('admin.common');
  const { send, pending } = useAdminRequest();
  const { send: sendTest, pending: testing } = useAdminRequest();
  const [provider, setProvider] = useState(view.settings.EMAIL_PROVIDER.panel ?? SERVER_DEFAULT);
  const [from, setFrom] = useState(view.settings.EMAIL_FROM.panel ?? '');
  const serverProvider = view.settings.EMAIL_PROVIDER.env;
  const providerName = (value: string | null) =>
    value === 'resend' ? t('resend') : value === 'log' ? t('logProvider') : t('off');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const res = await send('/api/admin/settings', 'PUT', {
      settings: {
        EMAIL_PROVIDER: provider === SERVER_DEFAULT ? null : provider,
        EMAIL_FROM: from.trim() || null,
      },
    });
    if (res.ok) toast.success(common('saved'));
    else if (res.status === 400) toast.error(t('invalidSender'));
    else if (res.status !== 403 && res.status !== 429) toast.error(common('error'));
  }

  async function test() {
    const res = await sendTest<EmailTest>('/api/admin/email/test', 'POST', undefined, {
      refresh: false,
    });
    if (!res.ok || !res.data) return;
    if (res.data.ok) toast.success(t('testSent', { email: adminEmail }));
    else toast.error(res.data.reason === 'not_configured' ? t('testNotConfigured') : t('testFailed'));
  }

  return (
    <>
      <Section
        title={t('statusTitle')}
        action={
          <Tag variant={available ? 'primary' : 'warning'}>
            {available ? t('onTag') : t('offTag')}
          </Tag>
        }
      >
        <div className="-mt-1 flex flex-col gap-1">
          <p className="text-caption text-pretty">{available ? t('available') : t('unavailable')}</p>
          <p className={cn(HINT, '[overflow-wrap:anywhere]')}>
            {appUrl ? t('linksTo', { url: appUrl }) : t('noAppUrl')}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={test}
            loading={testing}
            disabled={testing}
            className="h-12"
          >
            {t('test')}
          </Button>
          <p className={cn(HINT, '[overflow-wrap:anywhere]')}>{t('testTo', { email: adminEmail })}</p>
        </div>
      </Section>

      <Section title={t('settingsTitle')} divider>
        <p className={DESCRIPTION}>{t('settingsHint')}</p>
        <form className="flex flex-col gap-4 pt-1" onSubmit={save}>
          <div className={FIELD}>
            <Label htmlFor="email-provider" className={LABEL}>
              {t('provider')}
            </Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="email-provider" className="sm:max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SERVER_DEFAULT}>
                  {common('serverDefault', { value: providerName(serverProvider) })}
                </SelectItem>
                {EMAIL_PROVIDER_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {providerName(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={FIELD}>
            <Label htmlFor="email-from" className={LABEL}>
              {t('from')}
            </Label>
            <Input
              id="email-from"
              value={from}
              placeholder={view.settings.EMAIL_FROM.env ?? t('fromPlaceholder')}
              onChange={(e) => setFrom(e.target.value)}
              autoComplete="off"
            />
            <p className={HINT}>{t('fromHint')}</p>
          </div>
          <Button type="submit" variant="ink" loading={pending} disabled={pending} className="self-start">
            {common('save')}
          </Button>
        </form>
        <div className="mt-3 border-t border-border pt-5">
          <SecretField
            secretKey="RESEND_API_KEY"
            label={t('apiKey')}
            view={view.secrets.RESEND_API_KEY}
          />
        </div>
      </Section>
    </>
  );
}
