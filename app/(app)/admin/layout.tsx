import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CaretLeftIcon, ShieldCheckIcon } from '@/components/ui/icon';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdminPage } from '@/lib/admin';

// Admin panel shell. Every page under /admin is for admins only: anyone else
// gets a 404 here, before any page queries run (lib/admin).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const t = await getTranslations('admin');

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
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
        <AdminNav />
        {children}
      </div>
    </main>
  );
}
