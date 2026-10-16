'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MinusIcon, PlusIcon } from '@/components/ui/icon';
import { Button, IconButton } from '@/components/ui/button';
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from '@/components/ui/bottom-sheet';
import { WheelPicker } from '@/components/ui/wheel-picker';

// Reps in reserve offered for a set; "none" leaves it unrecorded.
export const RIR_VALUES = [0, 1, 2, 3, 4, 5] as const;
type RirChoice = number | 'none';

const OPTIONS: { value: RirChoice; label: string }[] = [
  { value: 'none', label: '–' },
  ...RIR_VALUES.map((value) => ({ value, label: String(value) })),
];

// RIR of a set: a bottom sheet with a scroll wheel, -/+ and "Aplicar". The
// value is only committed by Apply; closing the sheet keeps the old one.
export function RirPicker({
  open,
  value,
  onClose,
  onChoose,
}: {
  open: boolean;
  value: number | null;
  onClose: () => void;
  onChoose: (value: number | null) => void;
}) {
  const t = useTranslations('session.editableSets');
  const [choice, setChoice] = useState<RirChoice>(value ?? 'none');

  useEffect(() => {
    if (open) setChoice(value ?? 'none');
  }, [open, value]);

  const index = OPTIONS.findIndex((option) => option.value === choice);
  function step(delta: number) {
    const next = OPTIONS[Math.min(OPTIONS.length - 1, Math.max(0, index + delta))];
    if (next) setChoice(next.value);
  }

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent aria-describedby={undefined} className="gap-4">
        <BottomSheetTitle>{t('chooseRir')}</BottomSheetTitle>
        <div className="flex items-center gap-3">
          <IconButton
            type="button"
            size="session"
            tone="outline"
            onClick={() => step(-1)}
            disabled={index <= 0}
            aria-label={t('decrease')}
          >
            <MinusIcon />
          </IconButton>
          <WheelPicker
            options={OPTIONS}
            value={choice}
            onChange={setChoice}
            label={t('chooseRir')}
            className="flex-1"
          />
          <IconButton
            type="button"
            size="session"
            tone="outline"
            onClick={() => step(1)}
            disabled={index >= OPTIONS.length - 1}
            aria-label={t('increase')}
          >
            <PlusIcon />
          </IconButton>
        </div>
        <Button
          type="button"
          size="session"
          className="w-full"
          onClick={() => onChoose(choice === 'none' ? null : choice)}
        >
          {t('applyValue')}
        </Button>
      </BottomSheetContent>
    </BottomSheet>
  );
}
