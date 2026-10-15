import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CaretLeftIcon } from '@/components/ui/icon';
import { AdminUsers } from '@/components/admin/admin-users';
import { listUsersForAdmin, requireAdminPage } from '@/lib/admin';

// Admin area: lists the accounts and lets an admin set a new password for
// someone else. Anyone who is not an admin gets a 404 (lib/admin).
export default async function AdminPage() {
  const session = await requireAdminPage();
  const t = await getTranslations('admin');
  const users = await listUsersForAdmin();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pb-7 pt-2">
      <Link
        href="/settings"
        className="-ml-3 inline-flex min-h-touch items-center gap-1 self-start rounded-sm px-2 text-caption font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CaretLeftIcon className="size-5" />
        {t('back')}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{t('title')}</h1>
        <p className="text-caption text-muted-foreground">{t('description')}</p>
      </div>
      <AdminUsers users={users} currentUserId={session.userId} />
    </main>
  );
}
