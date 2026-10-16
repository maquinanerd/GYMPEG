import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CaretLeftIcon } from '@/components/ui/icon';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdminPage } from '@/lib/admin';

// Admin panel shell. Every page under /admin is for admins only: anyone else
// gets a 404 here, before any page queries run (lib/admin).
// Layout: "‹ Perfil", the 28px title, the underlined section tabs across the
// 672px column, then the page straight on the background.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const t = await getTranslations('admin');

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col pb-7">
      <header className="flex flex-col gap-1 px-5 pb-3 pt-2">
        <Link
          href="/settings"
          className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-sm px-2 text-caption font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CaretLeftIcon aria-hidden className="size-4" />
          {t('back')}
        </Link>
        <h1 className="text-title">{t('title')}</h1>
      </header>
      <AdminNav />
      <div className="flex flex-col gap-8 px-5 pt-6">{children}</div>
    </main>
  );
}
