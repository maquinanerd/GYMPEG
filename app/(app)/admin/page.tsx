import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  BarbellIcon,
  CaretRightIcon,
  ChartLineUpIcon,
  PaperPlaneRightIcon,
  SparkleIcon,
  UserIcon,
} from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { IconCircle, ListRow } from '@/components/ui/list-row';
import { StatTile } from '@/components/ui/stat-tile';
import { requireAdminPage } from '@/lib/admin';
import { getOverviewStats } from '@/lib/admin-stats';
import { canSendAppLinks } from '@/lib/email';
import { getLlmProvider } from '@/lib/llm';
import { getRuntimeEnv } from '@/lib/runtime-env';

// Overview: how many people use the app, how much they train and what the AI
// costs, plus whether AI and e-mail are ready. Aggregates only.
export default async function AdminOverviewPage() {
  await requireAdminPage();
  const [t, format, stats, env] = await Promise.all([
    getTranslations('admin.overview'),
    getFormatter(),
    getOverviewStats(),
    getRuntimeEnv(),
  ]);
  const provider = getLlmProvider(env);
  const emailReady = canSendAppLinks(env);
  const number = (value: number) => format.number(value);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="admin-stats" className="flex flex-col gap-3">
        <h2 id="admin-stats" className="text-base font-semibold">
          {t('statsTitle')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label={t('accounts')}
            icon={UserIcon}
            value={number(stats.accounts)}
            caption={t('newAccounts', { count: stats.newAccounts7d })}
          />
          <StatTile
            label={t('activeLifters')}
            icon={ChartLineUpIcon}
            value={number(stats.activeLifters7d)}
            caption={t('last7Days')}
          />
          <StatTile
            label={t('workouts')}
            icon={BarbellIcon}
            value={number(stats.workouts7d)}
            caption={t('workouts30d', { count: stats.workouts30d })}
          />
          <StatTile
            label={t('aiCalls')}
            icon={SparkleIcon}
            value={number(stats.aiCalls7d)}
            caption={t('aiFailures', { count: stats.aiFailures7d })}
          />
          <StatTile
            label={t('aiCost')}
            icon={SparkleIcon}
            value={
              stats.aiCost7d === null
                ? '—'
                : format.number(stats.aiCost7d, { style: 'currency', currency: 'USD' })
            }
            caption={stats.aiCost7d === null ? t('noPrice') : t('last7Days')}
          />
          <StatTile
            label={t('admins')}
            icon={UserIcon}
            value={number(stats.admins)}
            caption={t('blocked', { count: stats.blocked })}
          />
        </div>
      </section>

      <section aria-labelledby="admin-status" className="flex flex-col gap-3">
        <h2 id="admin-status" className="text-base font-semibold">
          {t('statusTitle')}
        </h2>
        <Card>
          <CardContent className="py-1">
            <Link href="/admin/ai" className="block">
              <ListRow
                leading={
                  <IconCircle tone={provider.isConfigured() ? 'primary' : 'warning'}>
                    <SparkleIcon />
                  </IconCircle>
                }
                title={t('aiStatus', { provider: provider.label })}
                subtitle={
                  provider.isConfigured()
                    ? t('aiReady', { model: provider.model })
                    : t('aiMissingKey')
                }
                trailing={<CaretRightIcon className="size-5 text-muted-foreground" aria-hidden />}
              />
            </Link>
            <Link href="/admin/email" className="block">
              <ListRow
                leading={
                  <IconCircle tone={emailReady ? 'primary' : 'warning'}>
                    <PaperPlaneRightIcon />
                  </IconCircle>
                }
                title={t('emailStatus')}
                subtitle={emailReady ? t('emailReady') : t('emailOff')}
                trailing={<CaretRightIcon className="size-5 text-muted-foreground" aria-hidden />}
              />
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
