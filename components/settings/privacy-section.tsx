'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
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
import { SettingsHeading } from './settings-ui';

function sameEmail(typed: string, email: string): boolean {
  return typed.trim().toLowerCase() === email.toLowerCase();
}

// Data and privacy (LGPD, epic 1.7): download everything the account holds,
// or erase the account. Erasing asks for the password and the e-mail typed in
// full, and points to the export first.
export function PrivacySection({ email }: { email: string }) {
  const t = useTranslations('settings.privacy');
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="flex flex-col gap-3">
        <SettingsHeading description={t('exportDescription')}>{t('exportTitle')}</SettingsHeading>
        <Button asChild variant="outline" className="w-full sm:w-auto sm:self-start">
          <a href="/api/account/export" download>
            {t('exportAction')}
          </a>
        </Button>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <SettingsHeading description={t('deleteDescription')}>{t('deleteTitle')}</SettingsHeading>
        <Button
          type="button"
          variant="outline"
          className="w-full text-destructive-text sm:w-auto sm:self-start"
          onClick={() => setOpen(true)}
        >
          {t('deleteAction')}
        </Button>
      </section>

      <DeleteAccountDialog email={email} open={open} onOpenChange={setOpen} />
    </>
  );
}

// The erase confirmation, also opened from the "Excluir conta" row of Perfil.
// The delete button only turns on once the password is filled in and the
// typed e-mail is the account's; the server checks both again.
export function DeleteAccountDialog({
  email,
  open,
  onOpenChange,
}: {
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.privacy');
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emailMatches = sameEmail(confirmEmail, email);
  // Said once the lifter leaves the field, not on every keystroke.
  const emailError = emailTouched && confirmEmail.trim() !== '' && !emailMatches;

  function close(next: boolean) {
    if (deleting) return;
    onOpenChange(next);
    if (!next) {
      setPassword('');
      setConfirmEmail('');
      setEmailTouched(false);
      setError(null);
    }
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!sameEmail(confirmEmail, email)) {
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
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('confirmTitle')}</DialogTitle>
          <DialogDescription>{t('confirmDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={deleteAccount} className="flex flex-col gap-4" noValidate>
          <ul className="list-disc space-y-1 pl-5 text-caption text-muted-foreground">
            <li>{t('consequenceData')}</li>
            <li>{t('consequencePhotos')}</li>
            <li>{t('consequenceDevices')}</li>
          </ul>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-password">{t('passwordLabel')}</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-email">{t('emailLabel', { email })}</Label>
            <Input
              id="delete-email"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              aria-invalid={emailError || undefined}
              aria-describedby={emailError ? 'delete-email-error' : undefined}
              onChange={(event) => setConfirmEmail(event.target.value)}
              onBlur={() => setEmailTouched(true)}
            />
            {emailError && !error && (
              <p id="delete-email-error" role="alert" className="text-caption text-destructive-text">
                {t('emailMismatch')}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-caption text-destructive-text">
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
              loading={deleting}
              disabled={deleting || !password || !emailMatches}
            >
              {deleting ? t('deleting') : t('confirmAction')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
