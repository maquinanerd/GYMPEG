'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsHeading } from './settings-ui';

interface Props {
  otherSessions: number;
}

const MIN_PASSWORD_LENGTH = 8;

export function SecuritySection({ otherSessions: initialOtherSessions }: Props) {
  const t = useTranslations('settings.security');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [otherSessions, setOtherSessions] = useState(initialOtherSessions);
  const [signingOut, setSigningOut] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(t('tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError(t('mismatch'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 400) {
        setFormError(t('wrongCurrent'));
        return;
      }
      if (!res.ok) {
        setFormError(t('error'));
        return;
      }
      const data = (await res.json()) as { signedOutSessions?: number };
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtherSessions(0);
      toast.success(t('changed', { count: data.signedOutSessions ?? 0 }));
    } catch {
      setFormError(t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function signOutOthers() {
    setSigningOut(true);
    try {
      const res = await fetch('/api/auth/sessions', { method: 'DELETE' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { signedOutSessions?: number };
      setOtherSessions(0);
      toast.success(t('signedOut', { count: data.signedOutSessions ?? 0 }));
    } catch {
      toast.error(t('error'));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
        <form onSubmit={changePassword} className="flex flex-col gap-4" noValidate>
          <SettingsHeading>{t('passwordTitle')}</SettingsHeading>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">{t('currentPassword')}</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {formError && (
            <p role="alert" className="text-caption text-destructive-text">
              {formError}
            </p>
          )}
          <Button
            type="submit"
            loading={saving}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full sm:w-auto sm:self-start"
          >
            {saving ? t('saving') : t('submit')}
          </Button>
        </form>

        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <SettingsHeading description={t('otherDevices', { count: otherSessions })}>
            {t('devicesTitle')}
          </SettingsHeading>
          <Button
            type="button"
            variant="outline"
            onClick={signOutOthers}
            loading={signingOut}
            disabled={signingOut || otherSessions === 0}
            className="w-full sm:w-auto sm:self-start"
          >
            {t('signOutOthers')}
          </Button>
        </section>
    </>
  );
}
