'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from '@/lib/preferences';
import { SettingsHeading } from './settings-ui';

// Editor for the plate-calculator fallback inventory (issue #285). When a
// saved gym is active the calculator uses that gym's bars and plates; these
// per-unit localStorage prefs are what it falls back to with no active gym,
// and the only place an lb plate inventory lives (gyms store kg only). The
// settings UI for them was removed with the gym profiles (#274); this
// restores it.
export function PlateFallbackSection() {
  const t = useTranslations('settings');
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
    setHydrated(true);
  }, []);

  function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    // Re-read before writing: other settings cards keep their own copy of the
    // prefs, so spreading this component's state could resurrect stale values
    // they changed since mount.
    const next = { ...loadPreferences(), [key]: value };
    savePreferences(next);
    setPrefs(next);
  }

  return (
    <section className="flex flex-col gap-4">
      <SettingsHeading description={t('plateCalculatorDescription')}>
        {t('plateCalculator')}
      </SettingsHeading>
      <div className="flex flex-col gap-5">
        <BarPlatesRow
          unitLabel="kg"
          barWeight={prefs.barWeightKg}
          plates={prefs.platesKg}
          onBarChange={(v) => update('barWeightKg', v)}
          onPlatesChange={(v) => update('platesKg', v)}
          disabled={!hydrated}
        />
        <BarPlatesRow
          unitLabel="lb"
          barWeight={prefs.barWeightLb}
          plates={prefs.platesLb}
          onBarChange={(v) => update('barWeightLb', v)}
          onPlatesChange={(v) => update('platesLb', v)}
          disabled={!hydrated}
        />
      </div>
    </section>
  );
}

function BarPlatesRow({
  unitLabel,
  barWeight,
  plates,
  onBarChange,
  onPlatesChange,
  disabled,
}: {
  unitLabel: string;
  barWeight: number;
  plates: number[];
  onBarChange: (v: number) => void;
  onPlatesChange: (v: number[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('settings');
  // Edit plates as comma-separated text; commit a cleaned, descending list on
  // blur. Empty / invalid entries are dropped so the calculator stays sane.
  // The text is controlled and re-synced from the saved list, so the values
  // hydrated from localStorage after mount actually show up (the pre-#274
  // editor used defaultValue and silently displayed the defaults).
  const joinedPlates = plates.join(', ');
  const [platesText, setPlatesText] = useState(joinedPlates);
  useEffect(() => {
    setPlatesText(joinedPlates);
  }, [joinedPlates]);

  function commitPlates(raw: string) {
    const parsed = raw
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a);
    onPlatesChange(parsed);
    setPlatesText(parsed.join(', '));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-caption font-semibold text-muted-foreground">
        {t('equipment', { unit: unitLabel })}
      </p>
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`bar-${unitLabel}`} className="text-small text-muted-foreground">
            {t('barWeight', { unit: unitLabel })}
          </Label>
          <Input
            id={`bar-${unitLabel}`}
            type="number"
            inputMode="decimal"
            step="0.5"
            value={barWeight}
            disabled={disabled}
            onChange={(e) => onBarChange(parseFloat(e.target.value) || 0)}
            className="font-num tabular-nums stretch-112"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`plates-${unitLabel}`} className="text-small text-muted-foreground">
            {t('platesPerSide', { unit: unitLabel })}
          </Label>
          <Input
            id={`plates-${unitLabel}`}
            type="text"
            inputMode="decimal"
            value={platesText}
            disabled={disabled}
            onChange={(e) => setPlatesText(e.target.value)}
            onBlur={(e) => commitPlates(e.target.value)}
            placeholder={t('platesPlaceholder')}
          />
        </div>
      </div>
    </div>
  );
}
