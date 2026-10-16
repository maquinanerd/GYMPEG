'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckIcon, CircleNotchIcon, PlugIcon, WarningCircleIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AdminConfigView, ConnectionTest } from '@/lib/admin-config';
import {
  PANEL_PROVIDER_IDS,
  PROVIDER_KEYS,
  type PanelProviderId,
  type SettingKey,
} from '@/lib/admin-settings';
import { AI_FEATURES, type AiFeature } from '@/lib/ai/features';
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

export function AiSettings({ view, providers, active }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <ProviderChoice view={view} active={active} />
      {providers.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} view={view} />
      ))}
      <FeaturesCard view={view} />
      <PriceCard view={view} />
    </div>
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
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{t('providerTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {active.configured
            ? t('inUse', { provider: active.label, model: active.model })
            : t('inUseNoKey', { provider: active.label })}
        </p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save({
              AI_PROVIDER: primary === SERVER_DEFAULT ? null : primary,
              AI_FALLBACK_PROVIDER:
                fallback === SERVER_DEFAULT ? null : fallback === NO_FALLBACK ? '' : fallback,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-primary">{t('primary')}</Label>
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
            <div className="space-y-2">
              <Label htmlFor="ai-fallback">{t('fallback')}</Label>
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
          <p className="text-sm text-muted-foreground">{t('fallbackHint')}</p>
          <Button type="submit" disabled={pending} className="min-h-tap">
            {pending && <CircleNotchIcon className="animate-spin" aria-hidden="true" />}
            {common('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProviderCard({ provider, view }: { provider: ProviderInfo; view: AdminConfigView }) {
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
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{t(`providers.${provider.id}`)}</h2>
        <p className="text-sm text-muted-foreground">{t('modelInUse', { model: provider.model })}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <SecretField secretKey={keys.apiKey} label={t('apiKey')} view={view.secrets[keys.apiKey]} />

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save({ [keys.model]: model.trim() || null });
          }}
        >
          <Label htmlFor={`model-${provider.id}`}>{t('model')}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`model-${provider.id}`}
              value={model}
              placeholder={modelSetting.env ?? provider.model}
              onChange={(e) => setModel(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 font-mono"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {common('save')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('modelHint')}</p>
        </form>

        <div className="space-y-2">
          <Button type="button" variant="outline" size="sm" onClick={test} disabled={testing}>
            {testing ? (
              <CircleNotchIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <PlugIcon aria-hidden="true" />
            )}
            {testing ? common('testing') : t('test')}
          </Button>
          {result && (
            <p
              role="status"
              className={
                result.ok
                  ? 'flex items-center gap-1.5 text-sm'
                  : 'flex items-center gap-1.5 text-sm text-destructive'
              }
            >
              {result.ok ? (
                <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <WarningCircleIcon className="size-4 shrink-0" aria-hidden="true" />
              )}
              {result.ok
                ? t('testOk', { model: result.model, ms: result.latencyMs })
                : result.reason === 'not_configured'
                  ? t('testNoKey')
                  : t('testFailed', { detail: result.message ?? String(result.status ?? '') })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
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

function FeaturesCard({ view }: { view: AdminConfigView }) {
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
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{t('featuresTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('featuresHint')}</p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save({ AI_FEATURES_DISABLED: [...disabled].join(',') });
          }}
        >
          {AI_FEATURES.map((feature) => (
            <div key={feature} className="flex items-center justify-between gap-3">
              <Label htmlFor={`feature-${feature}`}>{t(`features.${FEATURE_KEYS[feature]}`)}</Label>
              <Switch
                id={`feature-${feature}`}
                checked={!disabled.has(feature)}
                onCheckedChange={(on) => toggle(feature, on)}
              />
            </div>
          ))}
          <Button type="submit" disabled={pending} className="min-h-tap">
            {common('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PriceCard({ view }: { view: AdminConfigView }) {
  const t = useTranslations('admin.ai');
  const common = useTranslations('admin.common');
  const { save, pending } = useSaveSettings();
  const input = view.settings.AI_COST_PER_MTOKEN_INPUT;
  const output = view.settings.AI_COST_PER_MTOKEN_OUTPUT;
  const [inputPrice, setInputPrice] = useState(input.panel ?? '');
  const [outputPrice, setOutputPrice] = useState(output.panel ?? '');

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{t('priceTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('priceHint')}</p>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save({
              AI_COST_PER_MTOKEN_INPUT: inputPrice.trim().replace(',', '.') || null,
              AI_COST_PER_MTOKEN_OUTPUT: outputPrice.trim().replace(',', '.') || null,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price-input">{t('priceInput')}</Label>
              <Input
                id="price-input"
                inputMode="decimal"
                value={inputPrice}
                placeholder={input.env ?? '0.10'}
                onChange={(e) => setInputPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-output">{t('priceOutput')}</Label>
              <Input
                id="price-output"
                inputMode="decimal"
                value={outputPrice}
                placeholder={output.env ?? '0.40'}
                onChange={(e) => setOutputPrice(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={pending} className="min-h-tap">
            {common('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
