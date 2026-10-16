'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowsClockwiseIcon,
  CopyIcon,
  DotsThreeIcon,
  KeyIcon,
  LockKeyIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
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
import { Button, IconButton } from '@/components/ui/button';
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
import { ListRow } from '@/components/ui/list-row';
import { Section } from '@/components/ui/section';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import type { AdminUserRow } from '@/lib/admin';
import { generatePassword } from '@/lib/random-password';
import { PASSWORD_MAX_BYTES } from '@/lib/schemas/auth';
import { ERROR, FIELD, HINT, LABEL, ROW_LABEL } from './admin-ui';
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

// Accounts as hairline rows: the e-mail, the role and block state as tags in
// words with the name and last activity, and a "…" menu with the actions
// (none on the admin's own row).
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
    <Section
      title={t('title', { count: users.length })}
      headerClassName="items-center"
      action={
        <Button
          type="button"
          variant="ink"
          size="sm"
          className="h-11"
          onClick={() => setDialog({ kind: 'create' })}
        >
          <PlusIcon aria-hidden="true" />
          {t('create')}
        </Button>
      }
    >
      <ul>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const tags = user.role === 'ADMIN' || user.blocked;
          return (
            <ListRow
              key={user.id}
              title={<span className="break-all">{user.email}</span>}
              meta={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {tags && (
                    <span className="flex gap-1.5">
                      {user.role === 'ADMIN' && <Tag variant="info">{t('adminTag')}</Tag>}
                      {user.blocked && <Tag variant="warning">{t('blockedTag')}</Tag>}
                    </span>
                  )}
                  <span>
                    {user.displayName
                      ? `${user.displayName} · ${activity(user)}`
                      : activity(user)}
                  </span>
                </span>
              }
              trailing={
                isSelf ? (
                  <Tag variant="muted" className="self-center">
                    {t('youTag')}
                  </Tag>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        type="button"
                        size="sm"
                        aria-label={t('actions', { email: user.email })}
                      >
                        <DotsThreeIcon weight="bold" aria-hidden="true" />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialog({ kind: 'password', user })}>
                        <KeyIcon aria-hidden="true" />
                        {t('setPassword')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          setDialog({ kind: user.blocked ? 'unblock' : 'block', user })
                        }
                      >
                        <LockKeyIcon aria-hidden="true" />
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
                        <ShieldCheckIcon aria-hidden="true" />
                        {user.role === 'ADMIN' ? t('removeAdmin') : t('makeAdmin')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive-text focus:text-destructive-text"
                        onSelect={() => setDialog({ kind: 'delete', user })}
                      >
                        <TrashIcon aria-hidden="true" />
                        {t('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              }
            />
          );
        })}
      </ul>

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
    </Section>
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
    <div className={FIELD}>
      <Label htmlFor={id} className={LABEL}>
        {t('newPassword')}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 px-3.5"
          onClick={() => onChange(generatePassword())}
        >
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
    <div className="flex flex-col gap-4">
      <p role="status" className="text-body">
        {message}
      </p>
      <div className="flex items-center gap-2">
        <Input readOnly value={password} aria-label={t('newPassword')} className="min-w-0 flex-1" />
        <IconButton type="button" tone="outline" aria-label={t('copy')} onClick={copy}>
          <CopyIcon aria-hidden="true" />
        </IconButton>
      </div>
      <p className={HINT}>{t('handOver')}</p>
      <DialogFooter>
        <Button type="button" variant="ink" onClick={onDone}>
          {t('finish')}
        </Button>
      </DialogFooter>
    </div>
  );
}

function SubmitButton({ pending, label, savingLabel }: { pending: boolean; label: string; savingLabel: string }) {
  return (
    <Button type="submit" variant="ink" loading={pending} disabled={pending}>
      {pending ? savingLabel : label}
    </Button>
  );
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className={ERROR}>
      {error}
    </p>
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
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className={FIELD}>
              <Label htmlFor="admin-create-email" className={LABEL}>
                {t('email')}
              </Label>
              <Input
                id="admin-create-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={FIELD}>
              <Label htmlFor="admin-create-name" className={LABEL}>
                {t('displayName')}
              </Label>
              <Input
                id="admin-create-name"
                autoComplete="off"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <PasswordField id="admin-create-password" value={password} onChange={setPassword} />
            <div className="flex min-h-[3.25rem] items-center justify-between gap-3 border-y border-border py-2">
              <Label htmlFor="admin-create-role" className={ROW_LABEL}>
                {t('makeAdminLabel')}
              </Label>
              <Switch id="admin-create-role" checked={makeAdmin} onCheckedChange={setMakeAdmin} />
            </div>
            <FormError error={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
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
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <p className={HINT}>{t('passwordDescription')}</p>
            <PasswordField id="admin-new-password" value={password} onChange={setPassword} />
            <FormError error={error} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
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
              <AlertDialogDescription className="break-words">
                {t(`${state.kind}Description`, { email: state.user.email })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{common('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                aria-busy={pending || undefined}
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
          <DialogDescription className="break-words">
            {t('deleteDescription', { email: user?.email ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className={FIELD}>
            <Label htmlFor="admin-delete-confirm" className={LABEL}>
              {t('deleteConfirmLabel')}
            </Label>
            <Input
              id="admin-delete-confirm"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <FormError error={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={reset}>
              {common('cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={pending}
              disabled={pending || typed.trim() !== user?.email}
            >
              {t('deleteConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
