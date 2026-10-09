'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getOutboxOwner } from '@/lib/outbox-owner';
import { clearDeletedAccountData } from '@/lib/local-data';

// Data and privacy (LGPD, epic 1.7): download everything the account holds,
// or erase the account. Erasing asks for the password and the e-mail typed in
// full, and points to the export first.
export function PrivacySection({ email }: { email: string }) {
  const t = useTranslations('settings.privacy');
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function close(next: boolean) {
    if (deleting) return;
    setOpen(next);
    if (!next) {
      setPassword('');
      setConfirmEmail('');
      setError(null);
    }
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (confirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
      setError(t('emailMismatch'));
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmEmail }),
      });
      if (res.status === 429) {
        setError(t('tooManyAttempts'));
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error?.includes('password') ? t('wrongPassword') : t('deleteError'));
        return;
      }
      const owner = getOutboxOwner();
      if (owner) await clearDeletedAccountData(owner);
      window.location.assign('/login?deleted=1');
    } catch {
      setError(t('deleteError'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldAlert className="size-4" />
          {t('title')}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-sm">
        <section className="space-y-2">
          <h3 className="font-medium">{t('exportTitle')}</h3>
          <p className="text-muted-foreground">{t('exportDescription')}</p>
          <Button asChild variant="outline" className="min-h-tap">
            <a href="/api/account/export" download>
              <Download className="size-4" />
              <span className="ml-2">{t('exportAction')}</span>
            </a>
          </Button>
        </section>

        <section className="space-y-2 rounded-md border border-destructive/40 p-3">
          <h3 className="font-medium text-destructive">{t('deleteTitle')}</h3>
          <p className="text-muted-foreground">{t('deleteDescription')}</p>
          <Button variant="destructive" className="min-h-tap" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" />
            <span className="ml-2">{t('deleteAction')}</span>
          </Button>
        </section>
      </CardContent>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('confirmDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={deleteAccount} className="space-y-4" noValidate>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('consequenceData')}</li>
              <li>{t('consequencePhotos')}</li>
              <li>{t('consequenceDevices')}</li>
            </ul>
            <div className="space-y-2">
              <Label htmlFor="delete-password">{t('passwordLabel')}</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-email">{t('emailLabel', { email })}</Label>
              <Input
                id="delete-email"
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => close(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || !password || !confirmEmail}
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                <span className={deleting ? 'ml-2' : undefined}>
                  {deleting ? t('deleting') : t('confirmAction')}
                </span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
