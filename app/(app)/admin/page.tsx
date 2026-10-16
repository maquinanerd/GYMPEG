import { getFormatter, getTranslations } from 'next-intl/server';
import { ListRow } from '@/components/ui/list-row';
import { Num } from '@/components/ui/num';
import { Section } from '@/components/ui/section';
import { Tag } from '@/components/ui/tag';
import { requireAdminPage } from '@/lib/admin';
import { getOverviewStats } from '@/lib/admin-stats';
import { canSendAppLinks } from '@/lib/email';
import { getLlmProvider } from '@/lib/llm';
import { getRuntimeEnv } from '@/lib/runtime-env';

// Overview: how many people use the app, how much they train and what the AI
// costs, plus whether AI and e-mail are ready. Aggregates only.
// Numbers are a <dl> straight on the page (no tiles); the status rows say
// their state in a tag and open the matching section.
export default async function AdminOverviewPage() {
  await requireAdminPage();
  const [t, format, stats, env] = await Promise.all([
    getTranslations('admin.overview'),
    getFormatter(),
    getOverviewStats(),
    getRuntimeEnv(),
  ]);
  const provider = getLlmProvider(env);
  const aiReady = provider.isConfigured();
  const emailReady = canSendAppLinks(env);
  const number = (value: number) => format.number(value);

  const figures = [
    {
      key: 'accounts',
      label: t('accounts'),
      value: number(stats.accounts),
      note: t('newAccounts', { count: stats.newAccounts7d }),
    },
    {
      key: 'active',
      label: t('activeLifters'),
      value: number(stats.activeLifters7d),
      note: t('last7Days'),
    },
    {
      key: 'workouts',
      label: t('workouts'),
      value: number(stats.workouts7d),
      note: t('workouts30d', { count: stats.workouts30d }),
    },
    {
      key: 'aiCalls',
      label: t('aiCalls'),
      value: number(stats.aiCalls7d),
      note: t('aiFailures', { count: stats.aiFailures7d }),
    },
    {
      key: 'aiCost',
      label: t('aiCost'),
      value:
        stats.aiCost7d === null
          ? '—'
          : format.number(stats.aiCost7d, { style: 'currency', currency: 'USD' }),
      note: stats.aiCost7d === null ? t('noPrice') : t('last7Days'),
    },
    {
      key: 'admins',
      label: t('admins'),
      value: number(stats.admins),
      note: t('blocked', { count: stats.blocked }),
    },
  ];

  return (
    <>
      <Section title={t('statsTitle')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {figures.map((figure) => (
            <div key={figure.key} className="flex min-w-0 flex-col">
              <dt className="text-[0.8125rem] font-medium text-muted-foreground">
                {figure.label}
              </dt>
              <dd className="mt-0.5 break-words">
                <Num stretch={118} className="text-[1.625rem] leading-tight">
                  {figure.value}
                </Num>
              </dd>
              <dd className="text-small text-muted-foreground">{figure.note}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={t('statusTitle')} divider>
        <ul>
          <ListRow
            href="/admin/ai"
            title={t('aiStatus', { provider: provider.label })}
            meta={aiReady ? t('aiReady', { model: provider.model }) : t('aiMissingKey')}
            trailing={
              <Tag variant={aiReady ? 'primary' : 'warning'} className="self-center">
                {aiReady ? t('ready') : t('noKey')}
              </Tag>
            }
            chevron
          />
          <ListRow
            href="/admin/email"
            title={t('emailStatus')}
            meta={emailReady ? t('emailReady') : t('emailOff')}
            trailing={
              <Tag variant={emailReady ? 'primary' : 'warning'} className="self-center">
                {emailReady ? t('on') : t('off')}
              </Tag>
            }
            chevron
          />
        </ul>
      </Section>
    </>
  );
}
