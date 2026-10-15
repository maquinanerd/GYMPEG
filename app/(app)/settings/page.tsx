import { getLocale, getTranslations } from 'next-intl/server';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasAiConsent } from '@/lib/ai/features';
import { trainingExperienceMessageKeys, trainingGoalMessageKeys } from '@/i18n/enum-keys';
import { ListRow } from '@/components/ui/list-row';
import { LogoutButton } from '@/components/auth/logout-button';
import { RowValue, SettingsGroup } from '@/components/settings/settings-ui';
import {
  DeleteAccountRow,
  LanguageRow,
  ThemeRow,
} from '@/components/settings/overview-rows';
import packageJson from '@/package.json';

// "RA" from "Rafa Almeida", "RA" from "rafa@…": the avatar letters.
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]![0]}${words[words.length - 1]![0]}` : name.trim().slice(0, 2);
  return letters.toLocaleUpperCase();
}

// Build tag shown at the foot: the package version and, when the deploy sets
// it (Coolify's SOURCE_COMMIT), the short commit.
function versionLabel(): string {
  const commit = process.env.SOURCE_COMMIT?.slice(0, 7);
  return commit ? `${packageJson.version} (${commit})` : packageJson.version;
}

// Perfil: who is signed in, then every setting as a grouped row that opens
// its own page (or a sheet, for theme and language), sign-out and the
// version. The long settings page of v1 lives on in /settings/<section>.
export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const profileT = await getTranslations('settings.profile');
  const onboardingT = await getTranslations('onboarding.experience');
  const locale = await getLocale();
  const auth = await requireSession();
  const [user, gymCount, integrationCount, otherSessions] = await Promise.all([
    db.user.findUnique({
      where: { id: auth.userId },
      select: {
        displayName: true,
        goal: true,
        experience: true,
        weeklyFrequency: true,
        unit: true,
        aiConsentAt: true,
        aiConsentVersion: true,
      },
    }),
    db.gym.count({ where: { userId: auth.userId } }),
    db.mcpAccessToken.count({ where: { userId: auth.userId, revokedAt: null } }),
    db.authSession.count({
      where: {
        userId: auth.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(auth.sid ? { id: { not: auth.sid } } : {}),
      },
    }),
  ]);

  const name = user?.displayName?.trim() || auth.email.split('@')[0] || auth.email;
  const goal = user?.goal ? profileT(trainingGoalMessageKeys[user.goal]) : null;
  const experience = user?.experience
    ? onboardingT(trainingExperienceMessageKeys[user.experience])
    : null;
  const meta =
    [
      experience,
      goal && experience ? goal.toLocaleLowerCase(locale) : goal,
      user?.weeklyFrequency ? t('overview.frequency', { count: user.weeklyFrequency }) : null,
    ]
      .filter(Boolean)
      .join(' · ') || auth.email;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-5 pb-7 pt-4">
      <header className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-ink text-heading font-semibold text-primary dark:text-primary-foreground"
        >
          {initialsOf(name)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-[1.5rem] font-semibold leading-tight tracking-[-0.01em]">
            {name}
          </h1>
          <p className="text-caption text-muted-foreground">{meta}</p>
        </div>
      </header>

      <SettingsGroup id="settings-training" title={t('overview.groups.training')}>
        <ListRow
          href="/settings/profile"
          title={t('overview.rows.profile')}
          trailing={<RowValue>{goal ?? profileT('notSet')}</RowValue>}
          chevron
        />
        <ListRow
          href="/settings/gyms"
          title={t('overview.rows.gyms')}
          trailing={<RowValue>{t('overview.values.gyms', { count: gymCount })}</RowValue>}
          chevron
        />
        <ListRow
          href="/settings/workout"
          title={t('overview.rows.workout')}
          trailing={<RowValue>{t('overview.values.workout')}</RowValue>}
          chevron
        />
      </SettingsGroup>

      <SettingsGroup id="settings-app" title={t('overview.groups.app')}>
        <ListRow
          href="/settings/profile#unit"
          title={t('overview.rows.unit')}
          trailing={<RowValue>{user?.unit === 'LB' ? 'lb' : 'kg'}</RowValue>}
          chevron
        />
        <ThemeRow />
        <LanguageRow />
      </SettingsGroup>

      <SettingsGroup id="settings-account" title={t('overview.groups.account')}>
        <ListRow
          href="/settings/security"
          title={t('overview.rows.security')}
          trailing={
            <RowValue>{t('overview.values.devices', { count: otherSessions + 1 })}</RowValue>
          }
          chevron
        />
        <ListRow
          href="/settings/integrations"
          title={t('overview.rows.integrations')}
          trailing={
            <RowValue>{t('overview.values.integrations', { count: integrationCount })}</RowValue>
          }
          chevron
        />
        <ListRow
          href="/settings/import"
          title={t('overview.rows.import')}
          trailing={<RowValue>{t('overview.values.import')}</RowValue>}
          chevron
        />
      </SettingsGroup>

      <SettingsGroup id="settings-data" title={t('overview.groups.data')}>
        <ListRow
          href="/settings/data"
          title={t('overview.rows.export')}
          trailing={<RowValue>{t('overview.values.export')}</RowValue>}
          chevron
        />
        <ListRow
          href="/settings/ai"
          title={t('overview.rows.ai')}
          trailing={
            <RowValue>
              {hasAiConsent(user ?? null) ? t('overview.values.aiOn') : t('overview.values.aiOff')}
            </RowValue>
          }
          chevron
        />
        <DeleteAccountRow email={auth.email} />
      </SettingsGroup>

      <LogoutButton label={t('overview.signOut')} />
      <p className="text-center text-small text-muted-foreground">
        {t('overview.version', { version: versionLabel() })}
      </p>
    </main>
  );
}
