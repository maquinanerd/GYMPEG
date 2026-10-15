import Link from 'next/link';
import { CaretLeftIcon, CaretRightIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// Layout pieces of Perfil and its pages: straight on the page, split by
// hairlines, no cards.

// A Perfil group: a 14/600 muted heading over a list of rows.
export function SettingsGroup({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h2 id={id} className="mb-1 text-caption font-semibold text-muted-foreground">
        {title}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

// The muted value at the right of a row ("kg", "2 academias"). Pass it to
// ListRow as `trailing`: its `value` prop collides with <li value> typing.
export function RowValue({ children }: { children: React.ReactNode }) {
  return <span className="text-caption text-muted-foreground">{children}</span>;
}

// A row that opens a sheet or a dialog instead of a page: the ListRow grid on
// a <button>, inside the row's <li>.
export const rowButtonClass =
  'grid min-h-[3.25rem] w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

export function RowButtonContent({
  title,
  value,
  chevron = true,
  className,
}: {
  title: React.ReactNode;
  value?: React.ReactNode;
  chevron?: boolean;
  className?: string;
}) {
  return (
    <>
      <span className={cn('text-body font-semibold', className)}>{title}</span>
      {value != null ? <RowValue>{value}</RowValue> : <span />}
      {chevron ? <CaretRightIcon aria-hidden className="size-4 text-subtle" /> : <span />}
    </>
  );
}

// A page opened from a Perfil row: "‹ Perfil", the 28px title, an optional
// line under it, then the content in the 672px column.
export function SettingsSubpage({
  backLabel,
  title,
  description,
  children,
}: {
  backLabel: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-7">
      <header className="flex flex-col gap-1 pb-5 pt-2">
        <Link
          href="/settings"
          className="-ml-2 flex h-11 w-fit items-center gap-1 rounded-sm px-2 text-caption font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CaretLeftIcon aria-hidden className="size-4" />
          {backLabel}
        </Link>
        <h1 className="text-title">{title}</h1>
        {description && (
          <p className="text-caption text-muted-foreground text-pretty">{description}</p>
        )}
      </header>
      <div className="flex flex-col gap-8">{children}</div>
    </main>
  );
}

// Title of a block inside a settings page (17/600).
export function SettingsHeading({
  id,
  children,
  description,
}: {
  id?: string;
  children: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="text-subtitle">
        {children}
      </h2>
      {description && (
        <p className="text-caption text-muted-foreground text-pretty">{description}</p>
      )}
    </div>
  );
}
