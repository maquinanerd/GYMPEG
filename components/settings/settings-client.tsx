'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from '@/lib/preferences';

// "Durante o treino": the device-only preferences of the running workout, one
// switch per row. Language and theme live on Perfil itself; the plate
// calculator and the backup have their own sections.
export function SettingsClient() {
  const t = useTranslations('settings');
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
    setHydrated(true);
  }, []);

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    // Re-read before writing: the plate-fallback section keeps its own copy
    // of the prefs, so spreading this component's state could resurrect
    // stale values it changed since mount.
    const next = { ...loadPreferences(), [key]: value };
    savePreferences(next);
    setPrefs(next);
  }

  return (
    <ul className="border-b border-border">
      <PrefRow
        label={t('vibration')}
        description={t('vibrationDescription')}
        checked={prefs.vibration}
        onChange={(v) => update('vibration', v)}
        disabled={!hydrated}
      />
      <PrefRow
        label={t('timerSound')}
        description={t('timerSoundDescription')}
        checked={prefs.restTimerSound}
        onChange={(v) => update('restTimerSound', v)}
        disabled={!hydrated}
      />
      <PrefRow
        label={t('restFlash')}
        description={t('restFlashDescription')}
        checked={prefs.restEndFlash}
        onChange={(v) => update('restEndFlash', v)}
        disabled={!hydrated}
      />
      <PrefRow
        label={t('readiness')}
        description={t('readinessDescription')}
        checked={prefs.readinessAutoRegulation}
        onChange={(v) => update('readinessAutoRegulation', v)}
        disabled={!hydrated}
      />
    </ul>
  );
}

function PrefRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <li className="border-t border-border">
      <label className="flex min-h-[3.25rem] items-center justify-between gap-4 py-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-semibold">{label}</span>
          <span className="text-[0.8125rem] font-medium text-muted-foreground text-pretty">
            {description}
          </span>
        </span>
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </label>
    </li>
  );
}
