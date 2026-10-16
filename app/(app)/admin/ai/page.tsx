import { getFormatter, getTranslations } from 'next-intl/server';
import { Num } from '@/components/ui/num';
import { Section } from '@/components/ui/section';
import { AiSettings, type ProviderInfo } from '@/components/admin/ai-settings';
import { requireAdminPage } from '@/lib/admin';
import { getAdminConfigView } from '@/lib/admin-config';
import { PROVIDER_KEYS } from '@/lib/admin-settings';
import { getAiUsageSummary, type AiUsageRow } from '@/lib/admin-stats';
import { createProvider, getLlmProvider } from '@/lib/llm';
import { getRuntimeEnv } from '@/lib/runtime-env';

// AI: which provider and models answer, their keys, the features that are on,
// prices for the cost estimate, and what the last 30 days of calls cost.
export default async function AdminAiPage() {
  await requireAdminPage();
  const [t, format, env, view, usage] = await Promise.all([
    getTranslations('admin.ai'),
    getFormatter(),
    getRuntimeEnv(),
    getAdminConfigView(),
    getAiUsageSummary(30),
  ]);
  const providers: ProviderInfo[] = (Object.keys(PROVIDER_KEYS) as ProviderInfo['id'][]).map(
    (id) => {
      const provider = createProvider(id, env);
      return { id, label: provider.label, model: provider.model, configured: provider.isConfigured() };
    },
  );
  const active = getLlmProvider(env);

  const cost = (value: number | null) =>
    value === null ? '—' : format.number(value, { style: 'currency', currency: 'USD' });
  const usageCells = (row: AiUsageRow) => [
    format.number(row.calls),
    format.number(row.failures),
    format.number(row.inputTokens + row.outputTokens),
    cost(row.cost),
    t('usage.latency', { ms: row.avgLatencyMs }),
  ];
  const columns = [
    t('usage.calls'),
    t('usage.failures'),
    t('usage.tokens'),
    t('usage.cost'),
    t('usage.avgLatency'),
  ];

  return (
    <>
      <AiSettings
        view={view}
        providers={providers}
        active={{ label: active.label, model: active.model, configured: active.isConfigured() }}
      />

      <Section title={t('usage.title', { days: usage.days })} divider>
        <p className="-mt-1 text-caption text-muted-foreground text-pretty">
          {usage.total.calls === 0
            ? t('usage.empty')
            : t('usage.summary', {
                calls: usage.total.calls,
                failures: usage.total.failures,
                cost: cost(usage.total.cost),
              })}
        </p>
        {usage.total.calls > 0 && (
          <div className="flex flex-col gap-6 pt-2">
            <UsageTable
              caption={t('usage.byModel')}
              columns={[t('usage.model'), ...columns]}
              rows={usage.byModel.map((row) => ({
                key: `${row.provider}/${row.model}`,
                label: `${row.provider} · ${row.model}`,
                cells: usageCells(row),
              }))}
            />
            <UsageTable
              caption={t('usage.byOperation')}
              columns={[t('usage.operation'), ...columns]}
              rows={usage.byOperation.map((row) => ({
                key: row.operation,
                label: t(`operations.${row.operation}`),
                cells: usageCells(row),
              }))}
            />
          </div>
        )}
      </Section>
    </>
  );
}

const TH = 'py-2 text-small font-semibold text-muted-foreground';

function UsageTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: { key: string; label: string; cells: string[] }[];
}) {
  // Wider than a phone: the table scrolls sideways inside the 20px gutters.
  return (
    <div className="-mx-5 overflow-x-auto px-5 scrollbar-none">
      <table className="w-full min-w-[32rem] border-collapse text-caption">
        <caption className="pb-1 text-left text-subtitle">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={index === 0 ? `${TH} pr-3 text-left` : `${TH} pl-3 text-right`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border">
              <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                {row.label}
              </th>
              {row.cells.map((cell, index) => (
                <td key={index} className="py-2.5 pl-3 text-right">
                  <Num stretch={112}>{cell}</Num>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
