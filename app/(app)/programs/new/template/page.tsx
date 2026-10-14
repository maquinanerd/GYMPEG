import Link from 'next/link';
import { CaretLeftIcon } from '@/components/ui/icon';
import { getMessages, getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { TemplatePicker } from '@/components/programs/template-picker';
import { localizeProgramTemplate, programTemplates } from '@/lib/programs/templates';

export default async function TemplateProgramPage() {
  const t = await getTranslations('programs');
  const common = await getTranslations('common');
  await requireSession();
  // In the user's language: the picker shows these texts and the program is
  // saved with them.
  const messages = await getMessages();
  const templates = programTemplates.map((template) =>
    localizeProgramTemplate(template, messages.programTemplates),
  );

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href="/programs/new">
            <CaretLeftIcon className="size-4" />
            <span className="ml-1">{common('actions.back')}</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('startFromTemplate')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('templateDescription')}
          </p>
        </div>
        <TemplatePicker templates={templates} />
      </div>
    </main>
  );
}
