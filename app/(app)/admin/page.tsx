import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CaretLeftIcon, ShieldCheckIcon } from '@/components/ui/icon';
import { AdminUsers } from '@/components/admin/admin-users';
import { listUsersForAdmin, requireAdminPage } from '@/lib/admin';

// Admin area: lists the accounts and lets an admin set a new password for
// someone else. Anyone who is not an admin gets a 404 (lib/admin).
export default async function AdminPage() {
  const session = await requireAdminPage();
  const t = await getTranslations('admin');
  const users = await listUsersForAdmin();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <CaretLeftIcon className="size-4" aria-hidden="true" />
          {t('back')}
        </Link>
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="size-6" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <AdminUsers users={users} currentUserId={session.userId} />
      </div>
    </main>
  );
}
