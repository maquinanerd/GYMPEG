'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <Card>
      <CardHeader className="pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {t('title')}
        </h2>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={changePassword} className="space-y-3" noValidate>
          <h3 className="text-sm font-medium">{t('passwordTitle')}</h3>
          <div className="space-y-2">
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
          <div className="space-y-2">
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
          <div className="space-y-2">
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
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="min-h-tap w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            <span className="ml-2">{saving ? t('saving') : t('submit')}</span>
          </Button>
        </form>

        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-medium">{t('devicesTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('otherDevices', { count: otherSessions })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={signOutOthers}
            disabled={signingOut || otherSessions === 0}
            className="min-h-tap w-full sm:w-auto"
          >
            {signingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            <span className="ml-2">{t('signOutOthers')}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
