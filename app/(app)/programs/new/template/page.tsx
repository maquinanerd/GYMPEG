import { getMessages, getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { TemplatePicker } from '@/components/programs/template-picker';
import { SubpageHeader } from '@/components/programs/subpage-header';
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
    <main className="mx-auto w-full max-w-2xl flex-1">
      <SubpageHeader
        backHref="/programs/new"
        backLabel={common('actions.back')}
        title={t('startFromTemplate')}
        description={t('templateDescription')}
      />
      <div className="px-5 pb-8 pt-5">
        <TemplatePicker templates={templates} />
      </div>
    </main>
  );
}
