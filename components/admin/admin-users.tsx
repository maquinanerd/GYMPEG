'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowsClockwiseIcon,
  CircleNotchIcon,
  CopyIcon,
  DotsThreeIcon,
  KeyIcon,
  LockKeyIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
} from '@/components/ui/icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconCircle, ListRow } from '@/components/ui/list-row';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import type { AdminUserRow } from '@/lib/admin';
import { generatePassword } from '@/lib/random-password';
import { PASSWORD_MAX_BYTES } from '@/lib/schemas/auth';
import { useAdminRequest } from './use-admin-request';

const MIN_PASSWORD_LENGTH = 8;

type ConfirmKind = 'block' | 'unblock' | 'makeAdmin' | 'removeAdmin';
type DialogState =
  | { kind: 'create' }
  | { kind: 'password' | 'delete' | ConfirmKind; user: AdminUserRow }
  | null;

interface Props {
  users: AdminUserRow[];
  currentUserId: string;
}

export function AdminUsers({ users, currentUserId }: Props) {
  const t = useTranslations('admin.users');
  const format = useFormatter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = () => setDialog(null);

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
    <section aria-labelledby="admin-users" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="admin-users" className="text-base font-semibold">
          {t('title', { count: users.length })}
        </h2>
        <Button type="button" size="sm" onClick={() => setDialog({ kind: 'create' })}>
          <PlusIcon aria-hidden="true" />
          {t('create')}
        </Button>
      </div>
      <Card>
        <CardContent className="py-1">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <ListRow
                key={user.id}
                leading={
                  <IconCircle tone={user.blocked ? 'warning' : 'pill'}>
                    {user.blocked ? <LockKeyIcon /> : <UserIcon />}
                  </IconCircle>
                }
                title={user.email}
                subtitle={
                  user.displayName ? `${user.displayName} · ${activity(user)}` : activity(user)
                }
                trailing={
                  <div className="flex shrink-0 items-center gap-2">
                    {user.role === 'ADMIN' && <Tag dot="brand">{t('adminTag')}</Tag>}
                    {user.blocked && <Tag dot="warning">{t('blockedTag')}</Tag>}
                    {isSelf ? (
                      <Tag>{t('youTag')}</Tag>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('actions', { email: user.email })}
                          >
                            <DotsThreeIcon aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setDialog({ kind: 'password', user })}>
                            <KeyIcon className="size-4" aria-hidden="true" />
                            {t('setPassword')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setDialog({ kind: user.blocked ? 'unblock' : 'block', user })
                            }
                          >
                            <LockKeyIcon className="size-4" aria-hidden="true" />
                            {user.blocked ? t('unblock') : t('block')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setDialog({
                                kind: user.role === 'ADMIN' ? 'removeAdmin' : 'makeAdmin',
                                user,
                              })
                            }
                          >
                            <ShieldCheckIcon className="size-4" aria-hidden="true" />
                            {user.role === 'ADMIN' ? t('removeAdmin') : t('makeAdmin')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDialog({ kind: 'delete', user })}
                          >
                            <TrashIcon className="size-4" aria-hidden="true" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                }
              />
            );
          })}
        </CardContent>
      </Card>

      <CreateUserDialog open={dialog?.kind === 'create'} onClose={close} />
      <SetPasswordDialog
        user={dialog?.kind === 'password' ? dialog.user : null}
        onClose={close}
      />
      <ConfirmUserDialog
        state={
          dialog && dialog.kind !== 'create' && dialog.kind !== 'password' && dialog.kind !== 'delete'
            ? { kind: dialog.kind, user: dialog.user }
            : null
        }
        onClose={close}
      />
      <DeleteUserDialog user={dialog?.kind === 'delete' ? dialog.user : null} onClose={close} />
    </section>
  );
}

// Same rules as the API (lib/schemas/auth), checked before the request.
function passwordProblem(password: string): 'tooShort' | 'tooLong' | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'tooShort';
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'tooLong';
  return null;
}

// Password field with a "Generate" button; shown in clear because the admin
// has to pass it on.
function PasswordField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('admin.users');
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('newPassword')}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(generatePassword())}>
          <ArrowsClockwiseIcon aria-hidden="true" />
          <span>{t('generate')}</span>
        </Button>
      </div>
    </div>
  );
}

// After a password is set: show it once more with a copy button.
function HandOver({ password, message, onDone }: { password: string; message: string; onDone: () => void }) {
  const t = useTranslations('admin.users');
  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyError'));
    }
  }
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm">
        {message}
      </p>
      <div className="flex items-center gap-2">
        <Input readOnly value={password} aria-label={t('newPassword')} className="font-mono" />
        <Button type="button" variant="outline" size="icon" onClick={copy}>
          <CopyIcon aria-hidden="true" />
          <span className="sr-only">{t('copy')}</span>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('handOver')}</p>
      <DialogFooter>
        <Button type="button" onClick={onDone} className="min-h-tap">
          {t('finish')}
        </Button>
      </DialogFooter>
    </div>
  );
}

function SubmitButton({ pending, label, savingLabel }: { pending: boolean; label: string; savingLabel: string }) {
  return (
    <Button type="submit" disabled={pending} className="min-h-tap">
      {pending && <CircleNotchIcon className="animate-spin" aria-hidden="true" />}
      <span>{pending ? savingLabel : label}</span>
    </Button>
  );
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('admin.users');
  const common = useTranslations('admin.common');
  const { send, pending } = useAdminRequest();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  function reset() {
    setEmail('');
    setDisplayName('');
    setPassword('');
    setMakeAdmin(false);
    setError(null);
    setCreated(false);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(t(problem, { min: MIN_PASSWORD_LENGTH }));
    const res = await send('/api/admin/users', 'POST', {
      email: email.trim(),
      password,
      displayName: displayName.trim() || null,
      role: makeAdmin ? 'ADMIN' : 'USER',
    });
    if (res.ok) return setCreated(true);
    if (res.status === 409) return setError(t('exists'));
    if (res.status === 400) return setError(t('invalidEmail'));
    if (res.status !== 403 && res.status !== 429) setError(common('error'));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && reset()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>
        {created ? (
          <HandOver password={password} message={t('created', { email: email.trim() })} onDone={reset} />
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="admin-create-email">{t('email')}</Label>
              <Input
                id="admin-create-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-create-name">{t('displayName')}</Label>
              <Input
                id="admin-create-name"
                autoComplete="off"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <PasswordField id="admin-create-password" value={password} onChange={setPassword} />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="admin-create-role">{t('makeAdminLabel')}</Label>
              <Switch id="admin-create-role" checked={makeAdmin} onCheckedChange={setMakeAdmin} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset} className="min-h-tap">
                {common('cancel')}
              </Button>
              <SubmitButton pending={pending} label={t('createSubmit')} savingLabel={common('saving')} />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SetPasswordDialog({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const t = useTranslations('admin.users');
  const common = useTranslations('admin.common');
  const { send, pending } = useAdminRequest();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ signedOutSessions: number } | null>(null);

  function reset() {
    setPassword('');
    setError(null);
    setDone(null);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(t(problem, { min: MIN_PASSWORD_LENGTH }));
    const res = await send<{ signedOutSessions?: number }>(
      `/api/admin/users/${encodeURIComponent(user.id)}/password`,
      'POST',
      { password },
      { refresh: false },
    );
    if (res.ok) return setDone({ signedOutSessions: res.data?.signedOutSessions ?? 0 });
    if (res.status === 403) return setError(common('forbidden'));
    if (res.status === 404) return setError(t('notFound'));
    if (res.status !== 429) setError(common('error'));
  }

  return (
    <Dialog open={user !== null} onOpenChange={(next) => !next && reset()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('passwordTitle')}</DialogTitle>
          <DialogDescription className="break-all">{user?.email}</DialogDescription>
        </DialogHeader>
        {done ? (
          <HandOver
            password={password}
            message={t('passwordDone', { count: done.signedOutSessions })}
            onDone={reset}
          />
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">{t('passwordDescription')}</p>
            <PasswordField id="admin-new-password" value={password} onChange={setPassword} />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset} className="min-h-tap">
                {common('cancel')}
              </Button>
              <SubmitButton pending={pending} label={t('setPassword')} savingLabel={common('saving')} />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const CONFIRM_BODY: Record<ConfirmKind, { blocked?: boolean; role?: 'USER' | 'ADMIN' }> = {
  block: { blocked: true },
  unblock: { blocked: false },
  makeAdmin: { role: 'ADMIN' },
  removeAdmin: { role: 'USER' },
};

function ConfirmUserDialog({
  state,
  onClose,
}: {
  state: { kind: ConfirmKind; user: AdminUserRow } | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.users');
  const common = useTranslations('admin.common');
  const { send, pending } = useAdminRequest();

  async function confirm() {
    if (!state) return;
    const res = await send(
      `/api/admin/users/${encodeURIComponent(state.user.id)}`,
      'PATCH',
      CONFIRM_BODY[state.kind],
    );
    if (res.ok) {
      toast.success(t(`${state.kind}Done`, { email: state.user.email }));
      onClose();
    } else if (res.status !== 403 && res.status !== 429) {
      toast.error(common('error'));
    }
  }

  return (
    <AlertDialog open={state !== null} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent>
        {state && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(`${state.kind}Title`)}</AlertDialogTitle>
              <AlertDialogDescription>
                {t(`${state.kind}Description`, { email: state.user.email })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{common('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={(event) => {
                  event.preventDefault();
                  void confirm();
                }}
              >
                {t(`${state.kind}Confirm`)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Erasing an account cannot be undone, so the admin retypes its e-mail.
function DeleteUserDialog({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const t = useTranslations('admin.users');
  const common = useTranslations('admin.common');
  const { send, pending } = useAdminRequest();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTyped('');
    setError(null);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);
    const res = await send(`/api/admin/users/${encodeURIComponent(user.id)}`, 'DELETE', {
      confirmEmail: typed.trim(),
    });
    if (res.ok) {
      toast.success(t('deleteDone', { email: user.email }));
      return reset();
    }
    if (res.status === 400) return setError(t('mismatch'));
    if (res.status !== 403 && res.status !== 429) setError(common('error'));
  }

  return (
    <Dialog open={user !== null} onOpenChange={(next) => !next && reset()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>{t('deleteDescription', { email: user?.email ?? '' })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="admin-delete-confirm">{t('deleteConfirmLabel')}</Label>
            <Input
              id="admin-delete-confirm"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={reset} className="min-h-tap">
              {common('cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || typed.trim() !== user?.email}
              className="min-h-tap"
            >
              {pending && <CircleNotchIcon className="animate-spin" aria-hidden="true" />}
              <span>{t('deleteConfirm')}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
