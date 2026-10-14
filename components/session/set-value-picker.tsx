'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CaretLeftIcon,
  CaretRightIcon,
  LockKeyIcon,
  MinusIcon,
  PlusIcon,
} from '@/components/ui/icon';
import { useLocale, useTranslations } from 'next-intl';
import type { WeightUnit } from '@/lib/prisma-client';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import { computeBestPlateLoad } from '@/lib/plates';
import { plateConfigForUnit } from '@/lib/preferences';
import { roundWeight, toDisplayWeight, unitLabel } from '@/lib/units';
import { BarbellSideDiagram } from '@/components/session/barbell-side-diagram';
import { Button, IconButton } from '@/components/ui/button';
import { BottomSheet, BottomSheetContent, BottomSheetTitle } from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';

interface PickerOption {
  value: number;
  canonicalValue?: number;
  label?: string;
}

interface Props {
  open: boolean;
  kind: 'weight' | 'reps';
  value: number;
  // The stored weight behind `value` (kg). Lets an unchanged Apply hand back
  // exactly what was logged, even when `value` is a rounded display number.
  canonicalValue?: number;
  options: PickerOption[];
  unit: WeightUnit;
  loadConstraints?: GymLoadConstraints | null;
  onClose: () => void;
  onChoose: (value: number, canonicalValue?: number) => void;
}

export function SetValuePicker({
  open,
  kind,
  value,
  canonicalValue,
  options,
  unit,
  loadConstraints = null,
  onClose,
  onChoose,
}: Props) {
  const t = useTranslations('session.editableSets');
  const calculatorT = useTranslations('session.calculator');
  const locale = useLocale();
  // The input is the single source of what Apply commits: the opening seed, a
  // tap and the wheel all write into it, and the highlighted row and the plate
  // preview are derived from it.
  const [manualValue, setManualValue] = useState(String(value));
  const listRef = useRef<HTMLDivElement | null>(null);
  // The sheet mounts its content after `open` flips, so the list is tracked as
  // state: measuring starts when the element exists, not when the picker opens.
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null);
  const attachList = useCallback((element: HTMLDivElement | null) => {
    listRef.current = element;
    setListElement(element);
  }, []);
  const [listHeight, setListHeight] = useState(0);
  // Room above the first row and below the last so every row can sit in the
  // middle of the wheel.
  const wheelPadding = Math.max(12, (listHeight - 64) / 2);
  // Which kind the open picker was last seeded for; null while closed.
  const seededKind = useRef<Props['kind'] | null>(null);
  // The value the picker opened on, until the lifter changes anything.
  const untouchedSeed = useRef<{ value: number; canonicalValue?: number } | null>(null);
  // Armed by a pointer-down or wheel event on the list. It stays armed after
  // the gesture ends, so momentum and the closing snap are still followed, until
  // a tap, focus, key press, typing or reopen disarms it. While disarmed,
  // programmatic recentering, focus and keyboard scrolling cannot move the value.
  const userScrolling = useRef(false);
  // The row the wheel is resting on: the opening anchor (the nearest row, which
  // is not the value itself for an off-grid weight), a tapped row, or the row the
  // last scroll settled on. The wheel replaces the value only when the centred
  // row differs from this one, so a scroll that snaps back to the same row (or
  // a relayout scroll) cannot swap an off-grid 73 for the 72.5 shown beside it.
  const centeredValue = useRef<number | null>(null);
  const scrollTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const previousKind = seededKind.current;
    seededKind.current = open ? kind : null;
    // Seed only when the picker opens or switches kind. The parent rebuilds
    // `options` on most renders, so reacting to its identity would throw away
    // a pending pick or a typed value while the picker is still open.
    if (!open || previousKind === kind) return;
    // Keep the exact current value: an option is adopted only when it is the
    // stored weight itself, never because it is merely the nearest one.
    const storedOption =
      canonicalValue == null
        ? undefined
        : options.find(
            (option) =>
              option.canonicalValue != null && nearlyEqual(option.canonicalValue, canonicalValue),
          );
    const seedValue = storedOption?.value ?? value;
    untouchedSeed.current = { value: seedValue, canonicalValue };
    userScrolling.current = false;
    centeredValue.current = nearestOptionValue(options, seedValue);
    setManualValue(String(seedValue));
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      anchorElement(listRef.current, seedValue)?.scrollIntoView?.({ block: 'center' });
    }, 0);
  }, [canonicalValue, kind, open, options, value]);

  useEffect(
    () => () => {
      window.clearTimeout(scrollTimer.current);
      seededKind.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!open || kind !== 'weight' || !listElement) return;
    const updateHeight = () => setListHeight(listElement.clientHeight);
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(listElement);
    return () => observer.disconnect();
  }, [kind, listElement, open]);

  // The list changes height while open (the plate diagram appears with the
  // first pick and the sheet reaches its maximum height): put the resting row
  // back in the middle. Skipped during a wheel gesture so it never fights the
  // lifter; while disarmed, this scroll cannot change the value.
  useLayoutEffect(() => {
    if (kind !== 'weight' || userScrolling.current || centeredValue.current == null) return;
    const list = listRef.current;
    const element = anchorElement(list, centeredValue.current);
    if (!list || !element) return;
    list.scrollTop = element.offsetTop - (list.clientHeight - element.offsetHeight) / 2;
  }, [kind, listHeight]);

  function selectOption(option: PickerOption, element: HTMLElement) {
    // A tap pins its value: the recentering scroll it starts is not a gesture,
    // so the rows passing under the pointer on the way cannot replace it.
    userScrolling.current = false;
    untouchedSeed.current = null;
    centeredValue.current = option.value;
    setManualValue(String(option.value));
    if (kind !== 'weight') return;
    const list = listRef.current;
    if (!list) return;
    const top = element.offsetTop - (list.clientHeight - element.offsetHeight) / 2;
    list.scrollTo?.({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function startWheelGesture() {
    // Touching the wheel changes nothing by itself: a typed value stays the
    // candidate until the wheel actually moves to another row.
    if (kind !== 'weight') return;
    userScrolling.current = true;
  }

  function endWheelGesture() {
    userScrolling.current = false;
  }

  function previewCenteredWeight() {
    if (kind !== 'weight' || !userScrolling.current || !listRef.current) return;
    const list = listRef.current;
    const listRect = list.getBoundingClientRect();
    const centerY = listRect.top + list.clientHeight / 2;
    const nearest = Array.from(
      list.querySelectorAll<HTMLElement>('[data-picker-option-value]'),
    ).reduce<{ value: number; distance: number } | null>((best, element) => {
      const option = Number(element.dataset.pickerOptionValue);
      if (!Number.isFinite(option)) return best;
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - centerY);
      return best == null || distance < best.distance ? { value: option, distance } : best;
    }, null);
    if (!nearest) return;
    if (centeredValue.current != null && nearlyEqual(nearest.value, centeredValue.current)) return;
    centeredValue.current = nearest.value;
    untouchedSeed.current = null;
    setManualValue(String(nearest.value));
  }

  const parsedManualValue = Number(manualValue);
  const manualValueInvalid =
    manualValue.trim() === '' || !Number.isFinite(parsedManualValue) || parsedManualValue < 0;
  // What Apply would commit right now; null while the entry cannot be applied.
  const candidateValue = manualValueInvalid
    ? null
    : kind === 'reps'
      ? Math.max(1, Math.round(parsedManualValue))
      : parsedManualValue;
  const plateLoad = useMemo(() => {
    if (
      kind !== 'weight' ||
      loadConstraints?.equipmentType !== 'BARBELL' ||
      candidateValue == null ||
      candidateValue <= 0
    ) {
      return null;
    }
    const fallback = plateConfigForUnit(unit);
    const bars = loadConstraints.barWeights?.length
      ? loadConstraints.barWeights.map((weight) => roundWeight(toDisplayWeight(weight, unit), 2))
      : [fallback.barWeight];
    const plates = loadConstraints.plateWeights?.length
      ? loadConstraints.plateWeights.map((weight) => roundWeight(toDisplayWeight(weight, unit), 2))
      : fallback.plates;
    return computeBestPlateLoad(candidateValue, bars, plates, fallback.barWeight);
  }, [candidateValue, kind, loadConstraints, unit]);

  // The -/+ buttons move to the neighbouring option (the loads this gym can
  // actually make, or the next rep count); without options, by one.
  function step(direction: 1 | -1) {
    const current = candidateValue ?? value;
    const values = options.map((option) => option.value).sort((a, b) => a - b);
    const next =
      values.length > 0
        ? direction > 0
          ? values.find((option) => option > current + 1e-9)
          : [...values].reverse().find((option) => option < current - 1e-9)
        : Math.max(kind === 'reps' ? 1 : 0, Math.round(current) + direction);
    if (next == null) return;
    userScrolling.current = false;
    untouchedSeed.current = null;
    centeredValue.current = next;
    setManualValue(String(next));
    if (kind !== 'weight') return;
    const list = listRef.current;
    const element = list?.querySelector<HTMLElement>(`[data-picker-option-value="${next}"]`);
    if (!list || !element) return;
    const top = element.offsetTop - (list.clientHeight - element.offsetHeight) / 2;
    list.scrollTo?.({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function applyManual() {
    if (manualValueInvalid) return;
    const parsed = parsedManualValue;
    if (kind === 'reps') {
      onChoose(Math.max(1, Math.round(parsed)));
      return;
    }
    const seed = untouchedSeed.current;
    if (seed?.canonicalValue != null && nearlyEqual(seed.value, parsed)) {
      onChoose(parsed, seed.canonicalValue);
      return;
    }
    const matchingOption = options.find((option) => nearlyEqual(option.value, parsed));
    if (matchingOption?.canonicalValue != null) {
      onChoose(parsed, matchingOption.canonicalValue);
    } else {
      onChoose(parsed);
    }
  }

  const label = unitLabel(unit);

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent aria-describedby={undefined} className="gap-3">
        <BottomSheetTitle>
          {kind === 'weight' ? t('chooseWeight', { unit }) : t('chooseReps')}
        </BottomSheetTitle>

        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            size="session"
            tone="pill"
            onClick={() => step(-1)}
            aria-label={t('decrease')}
          >
            <MinusIcon />
          </IconButton>
          <Input
            autoFocus
            type="number"
            inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
            step={kind === 'weight' ? '0.1' : '1'}
            min="0"
            value={manualValue}
            onChange={(event) => {
              untouchedSeed.current = null;
              // Typing takes over from the wheel: a scroll caused by the keyboard
              // resizing the sheet must not replace what was typed.
              userScrolling.current = false;
              setManualValue(event.target.value);
            }}
            className="h-16 flex-1 rounded-pill border-transparent bg-pill text-center text-number tabular-nums"
          />
          <IconButton
            type="button"
            size="session"
            tone="pill"
            onClick={() => step(1)}
            aria-label={t('increase')}
          >
            <PlusIcon />
          </IconButton>
        </div>

        {kind === 'weight' && plateLoad ? (
          <BarbellSideDiagram
            load={plateLoad}
            unitLabel={label}
            platesLabel={calculatorT('platesPerSide')}
            targetWeight={candidateValue ?? undefined}
            compact
          >
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {plateLoad.exact ? <LockKeyIcon className="size-3 text-brand" /> : null}
              <span>
                {calculatorT('achieved', {
                  weight: `${formatDisplayNumber(plateLoad.achievedWeight, locale)} ${label}`,
                  bar: `${formatDisplayNumber(plateLoad.barWeight, locale)} ${label}`,
                })}
              </span>
            </div>
          </BarbellSideDiagram>
        ) : null}

        {/* When the sheet runs out of height, the list shrinks with this box and
            scrolls inside it instead of spilling over the Apply button below
            (the wheel padding follows the new height). */}
        <div className="relative flex min-h-0 flex-col">
          <div
            ref={attachList}
            data-testid="set-value-options"
            data-weight-picker-list={kind === 'weight' ? 'true' : undefined}
            onPointerDown={startWheelGesture}
            onWheel={startWheelGesture}
            onFocus={endWheelGesture}
            onKeyDown={endWheelGesture}
            onScroll={previewCenteredWeight}
            style={
              kind === 'weight'
                ? { paddingTop: wheelPadding, paddingBottom: wheelPadding }
                : undefined
            }
            className={`max-h-[55vh] min-h-0 space-y-2 overflow-y-auto overscroll-contain ${
              kind === 'weight' ? 'snap-y snap-mandatory motion-safe:scroll-smooth' : 'py-1'
            }`}
          >
            {options.map((option) => {
              const selected = candidateValue != null && nearlyEqual(option.value, candidateValue);
              return (
                <button
                  key={`${option.value}:${option.canonicalValue ?? ''}`}
                  type="button"
                  aria-pressed={selected}
                  data-picker-option-value={kind === 'weight' ? option.value : undefined}
                  data-picker-selected={selected ? 'true' : undefined}
                  onClick={(event) => selectOption(option, event.currentTarget)}
                  className={`mx-auto flex h-16 w-full max-w-[15rem] items-center justify-center rounded-pill text-heading tabular-nums ${
                    kind === 'weight' ? 'snap-center' : ''
                  } ${selected ? 'bg-primary text-primary-foreground' : 'bg-pill text-foreground'}`}
                >
                  {option.label ?? option.value}{' '}
                  {kind === 'weight' ? unit.toLowerCase() : t('repsShort')}
                </button>
              );
            })}
          </div>

          {kind === 'weight' && options.length > 0 ? (
            <div
              data-testid="weight-picker-pointer"
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between text-brand"
            >
              <CaretRightIcon className="size-8" />
              <CaretLeftIcon className="size-8" />
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          size="session"
          className="w-full shrink-0"
          onClick={applyManual}
          disabled={manualValueInvalid}
        >
          {t('applyValue')}
        </Button>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
}

// The option closest to a value; null for an empty list.
function nearestOptionValue(options: PickerOption[], value: number): number | null {
  return options.reduce<number | null>(
    (best, option) =>
      best == null || Math.abs(option.value - value) < Math.abs(best - value) ? option.value : best,
    null,
  );
}

// The row to centre when the picker opens: the selected option, or for a value
// that is not on the list the nearest option, which is shown but not adopted.
function anchorElement(list: HTMLElement | null, value: number): HTMLElement | null {
  if (!list) return null;
  const selected = list.querySelector<HTMLElement>('[data-picker-selected="true"]');
  if (selected) return selected;
  return (
    Array.from(list.querySelectorAll<HTMLElement>('[data-picker-option-value]')).reduce<{
      element: HTMLElement;
      distance: number;
    } | null>((best, element) => {
      const option = Number(element.dataset.pickerOptionValue);
      if (!Number.isFinite(option)) return best;
      const distance = Math.abs(option - value);
      return best == null || distance < best.distance ? { element, distance } : best;
    }, null)?.element ?? null
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Plate math runs in the display unit already, so this only localizes the number.
function formatDisplayNumber(value: number, locale: string): string {
  return value.toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: false });
}
