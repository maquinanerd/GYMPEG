import Link from 'next/link';
import { CaretLeftIcon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/button';

// Header of a page under Programas (new program, templates, AI plan): the
// back caret on its own row, then the 32px title and an optional line.
export function SubpageHeader({
  backHref,
  backLabel,
  title,
  description,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col">
      <div className="px-2 pt-2">
        <IconButton asChild aria-label={backLabel}>
          <Link href={backHref}>
            <CaretLeftIcon />
          </Link>
        </IconButton>
      </div>
      <div className="flex flex-col gap-1 px-5 pt-1">
        <h1 className="text-balance text-[2rem] font-semibold leading-tight tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="max-w-prose text-caption text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
    </header>
  );
}
