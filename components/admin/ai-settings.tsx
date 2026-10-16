'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Section } from '@/components/ui/section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import type { AdminConfigView, ConnectionTest } from '@/lib/admin-config';
import {
  PANEL_PROVIDER_IDS,
  PROVIDER_KEYS,
  type PanelProviderId,
  type SettingKey,
} from '@/lib/admin-settings';
import { AI_FEATURES, type AiFeature } from '@/lib/ai/features';
import { cn } from '@/lib/utils';
import {
  DESCRIPTION,
  FIELD,
  HINT,
  INLINE_FORM,
  INLINE_INPUT,
  LABEL,
  NUMBER_INPUT,
  ROW_LABEL,
} from './admin-ui';
import { SecretField } from './secret-field';
import { useAdminRequest } from './use-admin-request';

export interface ProviderInfo {
  id: Exclude<PanelProviderId, 'demo'>;
  label: string;
  // Model in use with the current settings (panel, environment or default).
  model: string;
  configured: boolean;
}

interface Props {
  view: AdminConfigView;
  providers: ProviderInfo[];
  active: { label: string; model: string; configured: boolean };
}

// Radix Select cannot hold an empty value: these stand for "no panel value"
// (the environment applies) and "no fallback".
const SERVER_DEFAULT = '__server__';
const NO_FALLBACK = '__none__';

const FEATURE_KEYS: Record<AiFeature, 'workoutGeneration' | 'workoutAdjustment' | 'weeklyReview' | 'chat'> = {
  'ai.workout_generation': 'workoutGeneration',
  'ai.workout_adjustment': 'workoutAdjustment',
  'ai.weekly_review': 'weeklyReview',
  'ai.chat': 'chat',
};

function useSaveSettings() {
  const t = useTranslations('admin.common');
  const { send, pending } = useAdminRequest();
  async function save(settings: Partial<Record<SettingKey, string | null>>): Promise<boolean> {
    const res = await send('/api/admin/settings', 'PUT', { settings });
    if (res.ok) toast.success(t('saved'));
    else if (res.status === 400) toast.error(t('invalid'));
    else if (res.status !== 403 && res.status !== 429) toast.error(t('error'));
    return res.ok;
  }
  return { save, pending };
}

// The AI settings as titled sections straight on the page, split by hairlines:
// which provider answers, each provider's key / model / test, the features
// that are on and the prices for the cost estimate.
export function AiSettings({ view, providers, active }: Props) {
  return (
    <>
      <ProviderChoice view={view} active={active} />
      {providers.map((provider) => (
        <ProviderSection key={provider.id} provider={provider} view={view} />
      ))}
      <FeaturesSection view={view} />
      <PriceSection view={view} />
    </>
  );
}

function ProviderChoice({ view, active }: Pick<Props, 'view' | 'active'>) {
  const t = useTranslations('admin.ai');
  const common = useTranslations('admin.common');
  const { save, pending } = useSaveSettings();
  const [primary, setPrimary] = useState(view.settings.AI_PROVIDER.panel ?? SERVER_DEFAULT);
  const fallbackPanel = view.settings.AI_FALLBACK_PROVIDER.panel;
  const [fallback, setFallback] = useState(
    fallbackPanel === null ? SERVER_DEFAULT : fallbackPanel === '' ? NO_FALLBACK : fallbackPanel,
  );
  const providerName = (id: string) =>
    (PANEL_PROVIDER_IDS as readonly string[]).includes(id) ? t(`providers.${id as PanelProviderId}`) : id;
  const serverPrimary = view.settings.AI_PROVIDER.env;
  const serverFallback = view.settings.AI_FALLBACK_PROVIDER.env;

  return (
    <Section title={t('providerTitle')}>
      <p className={cn(DESCRIPTION, !active.configured && 'text-destructive-text')}>
        {active.configured
          ? t('inUse', { provider: active.label, model: active.model })
          : t('inUseNoKey', { provider: active.label })}
      </p>
      <form
        className="flex flex-col gap-4 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            AI_PROVIDER: primary === SERVER_DEFAULT ? null : primary,
            AI_FALLBACK_PROVIDER:
              fallback === SERVER_DEFAULT ? null : fallback === NO_FALLBACK ? '' : fallback,
          });
        }}
      >
        {/* minmax(0, 1fr): a long provider label truncates in its trigger
            instead of widening the page. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <div className={FIELD}>
            <Label htmlFor="ai-primary" className={LABEL}>
              {t('primary')}
            </Label>
            <Select value={primary} onValueChange={setPrimary}>
              <SelectTrigger id="ai-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SERVER_DEFAULT}>
                  {common('serverDefault', { value: providerName(serverPrimary ?? 'gemini') })}
                </SelectItem>
                {PANEL_PROVIDER_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {providerName(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={FIELD}>
            <Label htmlFor="ai-fallback" className={LABEL}>
              {t('fallback')}
            </Label>
            <Select value={fallback} onValueChange={setFallback}>
              <SelectTrigger id="ai-fallback">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SERVER_DEFAULT}>
                  {common('serverDefault', {
                    value: serverFallback ? providerName(serverFallback) : t('noFallback'),
                  })}
                </SelectItem>
                <SelectItem value={NO_FALLBACK}>{t('noFallback')}</SelectItem>
                {PANEL_PROVIDER_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {providerName(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className={HINT}>{t('fallbackHint')}</p>
        <Button type="submit" variant="ink" loading={pending} disabled={pending} className="self-start">
          {common('save')}
        </Button>
      </form>
    </Section>
  );
}

// One provider: whether it has a key (a tag), the key, the model and a
// connection test.
function ProviderSection({ provider, view }: { provider: ProviderInfo; view: AdminConfigView }) {
  const t = useTranslations('admin.ai');
  const common = useTranslations('admin.common');
  const keys = PROVIDER_KEYS[provider.id];
  const modelSetting = view.settings[keys.model];
  const { save, pending } = useSaveSettings();
  const { send, pending: testing } = useAdminRequest();
  const [model, setModel] = useState(modelSetting.panel ?? '');
  const [result, setResult] = useState<ConnectionTest | null>(null);

  async function test() {
    setResult(null);
    const res = await send<ConnectionTest>(
      '/api/admin/ai/test',
      'POST',
      { provider: provider.id },
      { refresh: false },
    );
    if (res.ok && res.data) setResult(res.data);
  }

  return (
    <Section
      title={t(`providers.${provider.id}`)}
      divider
      action={
        <Tag variant={provider.configured ? 'primary' : 'warning'}>
          {provider.configured ? t('ready') : t('noKey')}
        </Tag>
      }
    >
      <p className={cn(DESCRIPTION, 'break-words')}>{t('modelInUse', { model: provider.model })}</p>
      <div className="flex flex-col gap-5 pt-1">
        <SecretField secretKey={keys.apiKey} label={t('apiKey')} view={view.secrets[keys.apiKey]} />

        <form
          className={FIELD}
          onSubmit={(event) => {
            event.preventDefault();
            void save({ [keys.model]: model.trim() || null });
          }}
        >
          <Label htmlFor={`model-${provider.id}`} className={LABEL}>
            {t('model')}
          </Label>
          <div className={INLINE_FORM}>
            <Input
              id={`model-${provider.id}`}
              value={model}
              placeholder={modelSetting.env ?? provider.model}
              onChange={(e) => setModel(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className={INLINE_INPUT}
            />
            <Button type="submit" variant="ink" loading={pending} disabled={pending} className="h-12">
              {common('save')}
            </Button>
          </div>
          <p className={HINT}>{t('modelHint')}</p>
        </form>

        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={test}
            loading={testing}
            disabled={testing}
            className="h-12"
          >
            {testing ? common('testing') : t('test')}
          </Button>
          {result && (
            <p
              role="status"
              className={cn(
                'text-caption text-pretty break-words',
                !result.ok && 'text-destructive-text',
              )}
            >
              {result.ok
                ? t('testOk', { model: result.model, ms: result.latencyMs })
                : result.reason === 'not_configured'
                  ? t('testNoKey')
                  : t('testFailed', { detail: result.message ?? String(result.status ?? '') })}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function parseDisabled(value: string | null): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

// One switch per AI feature, as hairline rows.
function FeaturesSection({ view }: { view: AdminConfigView }) {
  const t = useTranslations('admin.ai');
  const common = useTranslations('admin.common');
  const { save, pending } = useSaveSettings();
  const setting = view.settings.AI_FEATURES_DISABLED;
  const [disabled, setDisabled] = useState(() => parseDisabled(setting.panel ?? setting.env));

  function toggle(feature: AiFeature, on: boolean) {
    setDisabled((current) => {
      const next = new Set(current);
      if (on) next.delete(feature);
      else next.add(feature);
      return next;
    });
  }

  return (
    <Section title={t('featuresTitle')} divider>
      <p className={DESCRIPTION}>{t('featuresHint')}</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save({ AI_FEATURES_DISABLED: [...disabled].join(',') });
        }}
      >
        <ul>
          {AI_FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex min-h-[3.25rem] items-center justify-between gap-3 border-t border-border py-2"
            >
              <Label htmlFor={`feature-${feature}`} className={ROW_LABEL}>
                {t(`features.${FEATURE_KEYS[feature]}`)}
              </Label>
              <Switch
                id={`feature-${feature}`}
                checked={!disabled.has(feature)}
                onCheckedChange={(on) => toggle(feature, on)}
              />
            </li>
          ))}
        </ul>
        <Button type="submit" variant="ink" loading={pending} disabled={pending} className="self-start">
          {common('save')}
        </Button>
      </form>
    </Section>
  );
}

// Price per million tokens, input and output, for the cost estimate.
function PriceSection({ view }: { view: AdminConfigView }) {
  const t = useTranslations('admin.ai');
  const common = useTranslations('admin.common');
  const { save, pending } = useSaveSettings();
  const input = view.settings.AI_COST_PER_MTOKEN_INPUT;
  const output = view.settings.AI_COST_PER_MTOKEN_OUTPUT;
  const [inputPrice, setInputPrice] = useState(input.panel ?? '');
  const [outputPrice, setOutputPrice] = useState(output.panel ?? '');

  return (
    <Section title={t('priceTitle')} divider>
      <p className={DESCRIPTION}>{t('priceHint')}</p>
      <form
        className="flex flex-col gap-4 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            AI_COST_PER_MTOKEN_INPUT: inputPrice.trim().replace(',', '.') || null,
            AI_COST_PER_MTOKEN_OUTPUT: outputPrice.trim().replace(',', '.') || null,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className={FIELD}>
            <Label htmlFor="price-input" className={LABEL}>
              {t('priceInput')}
            </Label>
            <Input
              id="price-input"
              inputMode="decimal"
              value={inputPrice}
              placeholder={input.env ?? '0.10'}
              onChange={(e) => setInputPrice(e.target.value)}
              className={NUMBER_INPUT}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="price-output" className={LABEL}>
              {t('priceOutput')}
            </Label>
            <Input
              id="price-output"
              inputMode="decimal"
              value={outputPrice}
              placeholder={output.env ?? '0.40'}
              onChange={(e) => setOutputPrice(e.target.value)}
              className={NUMBER_INPUT}
            />
          </div>
        </div>
        <Button type="submit" variant="ink" loading={pending} disabled={pending} className="self-start">
          {common('save')}
        </Button>
      </form>
    </Section>
  );
}
