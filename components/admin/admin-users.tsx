'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowsClockwiseIcon,
  CircleNotchIcon,
  CopyIcon,
  KeyIcon,
  UserIcon,
} from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { IconCircle, ListRow } from '@/components/ui/list-row';
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
    <Card>
      <CardContent className="pt-2">
        <h2 className="pb-1 pt-3 text-base font-semibold">
          {t('usersTitle', { count: users.length })}
        </h2>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <ListRow
              key={user.id}
              leading={
                <IconCircle>
                  <UserIcon />
                </IconCircle>
              }
              title={user.email}
              subtitle={
                user.displayName ? `${user.displayName} · ${activity(user)}` : activity(user)
              }
              trailing={
                <div className="flex shrink-0 items-center gap-2">
                  {user.role === 'ADMIN' && <Tag dot="brand">{t('adminTag')}</Tag>}
                  {isSelf ? (
                    <Tag>{t('youTag')}</Tag>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
      </CardContent>
      <SetPasswordDialog target={target} onClose={() => setTarget(null)} />
    </Card>
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
          <div className="space-y-4">
            <p role="status" className="text-sm">
              {t('done', { count: done.signedOutSessions })}
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={password}
                aria-label={t('newPassword')}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                <CopyIcon aria-hidden="true" />
                <span className="sr-only">{t('copy')}</span>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t('handOver')}</p>
            <DialogFooter>
              <Button type="button" onClick={close} className="min-h-tap">
                {t('finish')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">{t('dialogDescription')}</p>
            <div className="space-y-2">
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
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} className="min-h-tap">
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving || !password} className="min-h-tap">
                {saving ? (
                  <CircleNotchIcon className="animate-spin" aria-hidden="true" />
                ) : (
                  <KeyIcon aria-hidden="true" />
                )}
                <span>{saving ? t('saving') : t('submit')}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
