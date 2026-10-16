'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CircleNotchIcon, PaperPlaneRightIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminConfigView, EmailTest } from '@/lib/admin-config';
import { EMAIL_PROVIDER_VALUES } from '@/lib/admin-settings';
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">{t('statusTitle')}</h2>
          <p className={available ? 'text-sm' : 'text-sm text-destructive'}>
            {available ? t('available') : t('unavailable')}
          </p>
          <p className="text-sm text-muted-foreground">
            {appUrl ? t('linksTo', { url: appUrl }) : t('noAppUrl')}
          </p>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={test} disabled={testing}>
            {testing ? (
              <CircleNotchIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <PaperPlaneRightIcon aria-hidden="true" />
            )}
            {t('test', { email: adminEmail })}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">{t('settingsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('settingsHint')}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={save}>
            <div className="space-y-2">
              <Label htmlFor="email-provider">{t('provider')}</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="email-provider" className="max-w-xs">
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
            <div className="space-y-2">
              <Label htmlFor="email-from">{t('from')}</Label>
              <Input
                id="email-from"
                value={from}
                placeholder={view.settings.EMAIL_FROM.env ?? t('fromPlaceholder')}
                onChange={(e) => setFrom(e.target.value)}
                autoComplete="off"
              />
              <p className="text-sm text-muted-foreground">{t('fromHint')}</p>
            </div>
            <Button type="submit" disabled={pending} className="min-h-tap">
              {pending && <CircleNotchIcon className="animate-spin" aria-hidden="true" />}
              {common('save')}
            </Button>
          </form>
          <div className="border-t border-border pt-5">
            <SecretField
              secretKey="RESEND_API_KEY"
              label={t('apiKey')}
              view={view.secrets.RESEND_API_KEY}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
