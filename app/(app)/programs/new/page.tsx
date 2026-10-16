import { getTranslations } from 'next-intl/server';
import { ListRow } from '@/components/ui/list-row';
import { ProgramCreateForm } from '@/components/programs/program-create-form';
import { SubpageHeader } from '@/components/programs/subpage-header';

export default async function NewProgramPage() {
  const t = await getTranslations('programs');
  const aiT = await getTranslations('ai.planner');

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <SubpageHeader backHref="/programs" backLabel={t('detail.back')} title={t('newProgram')} />
      <div className="flex flex-col gap-6 px-5 pb-8 pt-4">
        <ul className="border-b border-border">
          <ListRow
            href="/programs/new/template"
            title={t('startFromTemplate')}
            meta={t('templateTeaser')}
            chevron
          />
          <ListRow
            href="/programs/generate"
            title={t('list.askCoach')}
            meta={aiT('description')}
            chevron
          />
        </ul>
        <ProgramCreateForm />
      </div>
    </main>
  );
}
