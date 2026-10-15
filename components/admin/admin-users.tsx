'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowsClockwiseIcon, CopyIcon, KeyIcon } from '@/components/ui/icon';
import { Button, IconButton } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ListRow } from '@/components/ui/list-row';
import { Tag } from '@/components/ui/tag';
import type { AdminUserRow } from '@/lib/admin';
import { generatePassword } from '@/lib/random-password';
import { PASSWORD_MAX_BYTES } from '@/lib/schemas/auth';

const MIN_PASSWORD_LENGTH = 8;

interface Props {
  users: AdminUserRow[];
  currentUserId: string;
}

export function AdminUsers({ users, currentUserId }: Props) {
  const t = useTranslations('admin');
  const format = useFormatter();
  const [target, setTarget] = useState<AdminUserRow | null>(null);

  function activity(user: AdminUserRow): string {
    if (!user.lastSeenAt) return t('neverSignedIn');
    return t('lastSeen', {
      date: format.dateTime(new Date(user.lastSeenAt), {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    });
  }

  return (
    <Section title={t('usersTitle', { count: users.length })} className="gap-1.5">
      <ul>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <ListRow
              key={user.id}
              title={<span className="break-all">{user.email}</span>}
              meta={user.displayName ? `${user.displayName} · ${activity(user)}` : activity(user)}
              trailing={
                <div className="flex shrink-0 items-center gap-2">
                  {user.role === 'ADMIN' && <Tag variant="primary">{t('adminTag')}</Tag>}
                  {isSelf ? (
                    <Tag variant="muted">{t('youTag')}</Tag>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-touch"
                      onClick={() => setTarget(user)}
                      aria-label={t('setPasswordFor', { email: user.email })}
                    >
                      <KeyIcon aria-hidden="true" />
                      <span className="hidden sm:inline">{t('setPassword')}</span>
                    </Button>
                  )}
                </div>
              }
            />
          );
        })}
      </ul>
      <SetPasswordDialog target={target} onClose={() => setTarget(null)} />
    </Section>
  );
}

function SetPasswordDialog({
  target,
  onClose,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ signedOutSessions: number } | null>(null);

  function close() {
    setPassword('');
    setError(null);
    setDone(null);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
      setError(t('tooLong'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(target.id)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? t('forbidden')
            : res.status === 404
              ? t('notFound')
              : res.status === 429
                ? t('rateLimited')
                : t('error'),
        );
        return;
      }
      const data = (await res.json()) as { signedOutSessions?: number };
      setDone({ signedOutSessions: data.signedOutSessions ?? 0 });
    } catch {
      setError(t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyError'));
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription className="break-all">{target?.email}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="text-body">
              {t('done', { count: done.signedOutSessions })}
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={password}
                aria-label={t('newPassword')}
                className="font-mono"
              />
              <IconButton type="button" tone="outline" onClick={copy} aria-label={t('copy')}>
                <CopyIcon />
              </IconButton>
            </div>
            <p className="text-caption text-muted-foreground">{t('handOver')}</p>
            <DialogFooter>
              <Button type="button" onClick={close}>
                {t('finish')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <p className="text-caption text-muted-foreground">{t('dialogDescription')}</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-new-password">{t('newPassword')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="admin-new-password"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-12 rounded-md"
                  onClick={() => {
                    setPassword(generatePassword());
                    setError(null);
                  }}
                >
                  <ArrowsClockwiseIcon aria-hidden="true" />
                  <span>{t('generate')}</span>
                </Button>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-caption text-destructive-text">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!password} loading={saving}>
                {t('submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
