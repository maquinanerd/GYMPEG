import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { McpSection } from '@/components/settings/mcp-section';
import { SettingsSubpage } from '@/components/settings/settings-ui';

export default async function IntegrationsSettingsPage() {
  const t = await getTranslations('settings');
  const auth = await requireSession();
  const tokens = await db.mcpAccessToken.findMany({
    where: { userId: auth.userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      canWrite: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return (
    <SettingsSubpage
      backLabel={t('title')}
      title={t('mcp.title')}
      description={t('mcp.description')}
    >
      <McpSection
        initialTokens={tokens.map((token) => ({
          ...token,
          createdAt: token.createdAt.toISOString(),
          lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </SettingsSubpage>
  );
}
