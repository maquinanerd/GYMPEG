import { getFormatter, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
    <div className="flex flex-col gap-6">
      <AiSettings
        view={view}
        providers={providers}
        active={{ label: active.label, model: active.model, configured: active.isConfigured() }}
      />

      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold">{t('usage.title', { days: usage.days })}</h2>
          <p className="text-sm text-muted-foreground">
            {usage.total.calls === 0
              ? t('usage.empty')
              : t('usage.summary', {
                  calls: usage.total.calls,
                  failures: usage.total.failures,
                  cost: cost(usage.total.cost),
                })}
          </p>
        </CardHeader>
        {usage.total.calls > 0 && (
          <CardContent className="space-y-6">
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
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function UsageTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: { key: string; label: string; cells: string[] }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <caption className="pb-2 text-left font-medium">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={index === 0 ? 'py-2 pr-3 font-normal' : 'py-2 pl-3 text-right font-normal'}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border last:border-b-0">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                {row.label}
              </th>
              {row.cells.map((cell, index) => (
                <td key={index} className="py-2 pl-3 text-right tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
