'use client';

import { Fragment, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  CaretDownIcon,
  CheckIcon,
  CircleNotchIcon,
  PencilSimpleIcon,
  PlusIcon,
  SlidersHorizontalIcon,
} from '@/components/ui/icon';
import { useLocale, useTranslations } from 'next-intl';
import type { Exercise, ProgramExercise, SetType, WeightUnit } from '@/lib/prisma-client';
import { resolveSetType, RPE_VALUES } from '@/lib/schemas/set';
import { Input } from '@/components/ui/input';
import type { PendingSet } from '@/lib/indexeddb';
import type { SerializedLastPerformance } from '@/components/session/session-runner';
import {
  LiveEquipmentWeightEditor,
  type LiveEquipmentOption,
} from '@/components/session/live-equipment-weight-editor';
import type { IntraSetRecommendation } from '@/lib/intra-set-autoregulation';
import type { GymLoadConstraints } from '@/lib/gym-loads';
import { constrainGymWeight, gymWeightOptions } from '@/lib/gym-loads';
import { suggestNextWeight, type ReadinessSignal } from '@/lib/progression';
import { estimate1RM, estimateRepMax } from '@/lib/stats';
import { suggestWarmupSets, type WarmupSuggestion } from '@/lib/warmup';
import {
  loadPreferences,
  savePreferences,
  SET_TABLE_METRICS,
  setTableMetricEnabled,
  type SetTableMetric,
} from '@/lib/preferences';
import {
  formatWeight,
  fromDisplayWeight,
  roundWeight,
  toDisplayWeight,
  unitLabel,
} from '@/lib/units';
import { detectPRs, type PRType } from '@/lib/records';
import { IconButton } from '@/components/ui/button';
import { FilterChip } from '@/components/ui/chip';
import { Highlight } from '@/components/ui/highlight';
import { SetCell, SetCheck } from '@/components/ui/set-check';
import { Tag } from '@/components/ui/tag';
import { SetValuePicker } from '@/components/session/set-value-picker';
import { RirPicker } from '@/components/session/rir-picker';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// What the screen's footer needs to mirror the set being logged ("Log set 2",
// "82.5 kg × 7") and whether it can log it now.
export interface CurrentSetSummary {
  number: number;
  weight: number;
  reps: number;
  isWarmup: boolean;
  canConfirm: boolean;
}

// Lets the footer log the current set through the row's own path (same
// validation, same values) instead of a second implementation.
export interface EditableSetsTableHandle {
  confirm: () => Promise<void>;
}

interface Props {
  programExercise: ProgramExercise & { exercise: Exercise };
  sets: PendingSet[];
  lastPerformance: SerializedLastPerformance | undefined;
  readiness: ReadinessSignal | null;
  deloadActive: boolean;
  unit: WeightUnit;
  recommendation?: IntraSetRecommendation | null;
  loadConstraints?: GymLoadConstraints | null;
  gymId?: string | null;
  equipmentOptions?: LiveEquipmentOption[];
  priorSets?: { weight: number; reps: number }[];
  disabled?: boolean;
  onSubmit: (values: {
    weight: number;
    reps: number;
    rir: number | null;
    durationSec: null;
    distanceM: null;
    isWarmup: boolean;
    isDropSet: boolean;
    notes: string | null;
    gymEquipmentId?: string | null;
    type: SetType;
    rpe: number | null;
  }) => Promise<void>;
  onEquipmentWeightsUpdated?: (equipment: LiveEquipmentOption) => void;
  onDeleteSet: (set: PendingSet) => Promise<boolean | void> | boolean | void;
  onUpdateSet: (set: PendingSet, values: DraftSet) => Promise<void>;
  actionRef?: React.Ref<EditableSetsTableHandle>;
  onCurrentSetChange?: (current: CurrentSetSummary) => void;
}

interface DraftSet {
  weight: number;
  reps: number;
  rir: number | null;
}

// Kinds offered for the next set, in the order lifters reach for them. Keys
// live under session.editableSets.setTypes.
const SET_TYPE_OPTIONS = [
  { type: 'WORKING', key: 'working' },
  { type: 'WARMUP', key: 'warmup' },
  { type: 'DROP', key: 'drop' },
  { type: 'AMRAP', key: 'amrap' },
  { type: 'FAILURE', key: 'failure' },
  { type: 'BACKOFF', key: 'backoff' },
] as const satisfies readonly { type: SetType; key: string }[];

// A number cell is 48px tall (the sheet's look) but its tap area reaches the
// 64px of the running workout through an invisible extension above and below.
const CELL_HIT_AREA = "relative after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']";

// The widened number shrinks on narrow phones so a five-character load
// ("102,5") still fits its column at 320px.
function cellTextSize(value: string): string {
  return value.length > 4
    ? 'text-[1.0625rem] font-semibold min-[375px]:text-heading'
    : 'text-heading font-semibold min-[360px]:text-number';
}

function metricValue(metric: SetTableMetric, draft: DraftSet): number {
  if (metric === 'VOLUME') return draft.weight * draft.reps;
  return metric === '10RM'
    ? estimateRepMax(draft.weight, draft.reps, 10)
    : estimate1RM(draft.weight, draft.reps);
}

// Machines, cables and "other" items carry their own discrete loads: on those
// the physical item, not the exercise's gym configuration, decides which
// weights exist. Free-weight items keep the exercise's own constraints.
function equipmentLoadConstraints(
  base: GymLoadConstraints | null,
  equipment: LiveEquipmentOption | undefined,
): GymLoadConstraints | null {
  if (!equipment || !['MACHINE', 'CABLE', 'OTHER'].includes(equipment.equipmentType)) return base;
  return {
    ...(base ?? {}),
    equipmentType: equipment.equipmentType,
    weightOptions: equipment.weightOptions,
  };
}

// Prefill of the next set: last session's set at the same position, shifted by
// today's change in load. This keeps the shape of the work (straight sets,
// pyramids, back-offs) while carrying the progression:
// - first working set: the change the progression engine suggests (double
//   progression, readiness, planned deload), so the one-tap path logs the
//   suggested increase instead of repeating last time's weight;
// - later sets: the change the lifter actually made on today's first set.
// After a load increase, reps restart at the bottom of the target range.
export function initialDraft(
  pe: Props['programExercise'],
  sets: PendingSet[],
  lastPerformance: SerializedLastPerformance | undefined,
  readiness: ReadinessSignal | null,
  deloadActive: boolean,
  loadConstraints: GymLoadConstraints | null,
  unit: WeightUnit = 'KG',
): DraftSet {
  const workingSets = sets.filter((set) => !set.isWarmup);
  const previousRows = lastPerformance?.sets ?? [];
  const previousRow = previousRows[workingSets.length];
  const previousFirst = previousRows[0];

  let offset = 0;
  const todayFirst = workingSets[0];
  if (todayFirst && previousFirst) {
    offset = todayFirst.weight - previousFirst.weight;
  } else if (!todayFirst && lastPerformance) {
    const suggestion = suggestNextWeight(
      pe,
      lastPerformance.sets,
      readiness,
      deloadActive,
      loadConstraints,
      unit,
    );
    if (suggestion.weight != null) offset = suggestion.weight - lastPerformance.maxWeight;
  }

  if (previousRow) {
    const target = Math.max(0, roundWeight(previousRow.weight + offset, 2));
    return {
      weight:
        offset === 0 ? previousRow.weight : constrainGymWeight(target, target, loadConstraints),
      reps: offset > 0 ? pe.targetRepsMin : previousRow.reps,
      rir: previousRow.rir,
    };
  }

  const lastWorking = workingSets.at(-1);
  if (lastWorking) {
    return { weight: lastWorking.weight, reps: lastWorking.reps, rir: lastWorking.rir };
  }

  return {
    weight: 0,
    reps: Math.round((pe.targetRepsMin + pe.targetRepsMax) / 2),
    rir: pe.targetRIR,
  };
}

// The set sheet of the running exercise (design v2): a real table of Set ·
// kg · reps · RIR · done. Warm-ups come first with their "W" tag (logged ones
// done, suggested ramp steps one tap away), then the working sets: logged
// rows stay editable, the current row is lit (white fields, prefilled with
// the suggestion) and confirmed with the round check, and the sets still to
// come show last time's numbers as a reference.
export function EditableSetsTable({
  programExercise,
  sets,
  lastPerformance,
  readiness,
  deloadActive,
  unit,
  recommendation = null,
  loadConstraints = null,
  gymId = null,
  equipmentOptions = [],
  priorSets = [],
  disabled = false,
  onSubmit,
  onEquipmentWeightsUpdated,
  onDeleteSet,
  onUpdateSet,
  actionRef,
  onCurrentSetChange,
}: Props) {
  const t = useTranslations('session.editableSets');
  const inputT = useTranslations('session.input');
  const locale = useLocale();
  const [metrics, setMetrics] = useState<SetTableMetric[]>(['1RM']);
  const [draft, setDraft] = useState<DraftSet>(() =>
    initialDraft(
      programExercise,
      sets,
      lastPerformance,
      readiness,
      deloadActive,
      loadConstraints,
      unit,
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [editingSet, setEditingSet] = useState<{ set: PendingSet; draft: DraftSet } | null>(null);
  const [updatingSetId, setUpdatingSetId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'weight' | 'reps' | null>(null);
  // The RIR sheet: open for a logged set, or for the next one (no set).
  const [rirTarget, setRirTarget] = useState<{ set?: PendingSet } | null>(null);
  const [appliedRecommendationKey, setAppliedRecommendationKey] = useState<string | null>(null);
  const [gymEquipmentId, setGymEquipmentId] = useState('');
  const [weightEditorOpen, setWeightEditorOpen] = useState(false);
  // Options of the next set: kind, RPE and note. They reset to a plain
  // working set after each confirmation and when the exercise changes.
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [nextType, setNextType] = useState<SetType>('WORKING');
  const [nextRpe, setNextRpe] = useState<number | null>(null);
  const [nextNotes, setNextNotes] = useState('');
  // Rows the lifter added to the plan of this exercise ("Add set"): display
  // only, the next row is always loggable whatever the count.
  const [extraRows, setExtraRows] = useState(0);
  const workingSets = useMemo(() => sets.filter((set) => !set.isWarmup), [sets]);
  const warmupSets = useMemo(() => sets.filter((set) => set.isWarmup), [sets]);
  const latestWorkingSetId = workingSets.at(-1)?.localId ?? null;
  // The exercise strip lets the lifter jump between exercises mid-entry. An
  // unconfirmed draft is parked per program row when they leave and restored
  // when they come back, as long as no set was logged there in between.
  const parkedDrafts = useRef(new Map<string, { draft: DraftSet; setCount: number }>());
  const shownRow = useRef({ id: programExercise.id, setCount: workingSets.length });
  const prT = useTranslations('session.setsList');
  const prBaseline = useMemo(
    () => priorSets.map((set) => ({ ...set, isWarmup: false })),
    [priorSets],
  );

  // Bar used as the floor of the warm-up ramp: the lightest bar of the gym,
  // else the lifter's preferred bar (localStorage, read after hydration).
  const [preferredBarKg, setPreferredBarKg] = useState(20);

  useEffect(() => {
    const prefs = loadPreferences();
    setMetrics(prefs.setTableMetrics);
    setPreferredBarKg(
      unit === 'LB' ? fromDisplayWeight(prefs.barWeightLb, 'LB') : prefs.barWeightKg,
    );
  }, [unit]);

  function metricLabel(metric: SetTableMetric, short = false) {
    if (metric === '1RM') return t(short ? 'metrics.oneRmShort' : 'metrics.oneRm');
    if (metric === '10RM') return t(short ? 'metrics.tenRmShort' : 'metrics.tenRm');
    return t(short ? 'metrics.volumeShort' : 'metrics.volume');
  }

  function updateMetric(metric: SetTableMetric, enabled: boolean) {
    const next = setTableMetricEnabled(metrics, metric, enabled);
    if (next.length === metrics.length && next.every((value, index) => value === metrics[index])) {
      return;
    }
    const prefs = loadPreferences();
    savePreferences({ ...prefs, setTableMetrics: next });
    setMetrics(next);
  }

  function formatMetric(metric: SetTableMetric, values: DraftSet): string {
    const value = metricValue(metric, values);
    if (value <= 0) return '-';
    return formatWeight(value, unit, {
      decimals: 1,
      group: false,
      locale,
      withUnit: metric !== 'VOLUME',
    });
  }

  function prsFor(set: PendingSet, index: number): PRType[] {
    const earlierThisSession = workingSets
      .slice(0, index)
      .map((row) => ({ weight: row.weight, reps: row.reps, isWarmup: false }));
    return detectPRs(set, [...prBaseline, ...earlierThisSession]);
  }

  useEffect(() => {
    const previous = shownRow.current;
    if (previous.id !== programExercise.id) {
      parkedDrafts.current.set(previous.id, { draft, setCount: previous.setCount });
    }
    shownRow.current = { id: programExercise.id, setCount: workingSets.length };
    const parked = parkedDrafts.current.get(programExercise.id);
    if (parked && previous.id !== programExercise.id && parked.setCount === workingSets.length) {
      parkedDrafts.current.delete(programExercise.id);
      setDraft(parked.draft);
    } else {
      parkedDrafts.current.delete(programExercise.id);
      setDraft(
        initialDraft(
          programExercise,
          sets,
          lastPerformance,
          readiness,
          deloadActive,
          loadConstraints,
          unit,
        ),
      );
    }
    setEditingSet(null);
    setPicker(null);
    setRirTarget(null);
    setAppliedRecommendationKey(null);
    if (previous.id !== programExercise.id) {
      resetNextOptions();
      setExtraRows(0);
    }
    const recentEquipmentId = workingSets.at(-1)?.gymEquipmentId ?? '';
    setGymEquipmentId(
      equipmentOptions.some((equipment) => equipment.id === recentEquipmentId)
        ? recentEquipmentId
        : '',
    );
    // Re-seed when the active exercise or logged working-set count changes.
    // exerciseId is part of the key because an in-session replace keeps the
    // program row id: the draft of the old exercise must not carry over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programExercise.id, programExercise.exerciseId, workingSets.length]);

  useEffect(() => {
    if (gymEquipmentId && !equipmentOptions.some((equipment) => equipment.id === gymEquipmentId)) {
      setGymEquipmentId('');
    }
  }, [equipmentOptions, gymEquipmentId]);

  const selectedEquipment = equipmentOptions.find((equipment) => equipment.id === gymEquipmentId);
  const usesSelectedEquipmentWeights =
    selectedEquipment != null &&
    ['MACHINE', 'CABLE', 'OTHER'].includes(selectedEquipment.equipmentType);
  const canEditSelectedEquipment = gymId != null && usesSelectedEquipmentWeights;
  const effectiveLoadConstraints = useMemo(
    () => equipmentLoadConstraints(loadConstraints, selectedEquipment),
    [loadConstraints, selectedEquipment],
  );
  // A logged set is constrained by the equipment it was logged on, which is
  // not necessarily the one currently selected for the next set.
  function loadConstraintsForSet(set: PendingSet): GymLoadConstraints | null {
    return equipmentLoadConstraints(
      loadConstraints,
      equipmentOptions.find((equipment) => equipment.id === set.gymEquipmentId),
    );
  }
  // The picker edits either a logged row or the next set: its options and its
  // plate preview follow the equipment of the row it was opened for.
  const editedSet = editingSet?.set ?? null;
  const pickerLoadConstraints = useMemo(
    () =>
      editedSet
        ? equipmentLoadConstraints(
            loadConstraints,
            equipmentOptions.find((equipment) => equipment.id === editedSet.gymEquipmentId),
          )
        : effectiveLoadConstraints,
    [editedSet, effectiveLoadConstraints, equipmentOptions, loadConstraints],
  );
  const pickerReferenceWeight = editingSet?.draft.weight ?? draft.weight;

  // Ramp up to the first working set, offered until that set is logged.
  const warmupSuggestions = useMemo(() => {
    if (workingSets.length > 0) return [];
    const gymBars = loadConstraints?.barWeights?.filter((weight) => weight > 0) ?? [];
    return suggestWarmupSets({
      workingWeightKg: draft.weight,
      unit,
      equipmentType: programExercise.exercise.equipmentType,
      usesBodyweight: programExercise.exercise.usesBodyweight,
      barWeightKg: gymBars.length > 0 ? Math.min(...gymBars) : preferredBarKg,
      loggedWarmups: warmupSets.length,
    });
  }, [
    draft.weight,
    loadConstraints,
    preferredBarKg,
    programExercise.exercise.equipmentType,
    programExercise.exercise.usesBodyweight,
    unit,
    warmupSets.length,
    workingSets.length,
  ]);

  const currentNumber = workingSets.length + 1;
  const totalRows = Math.max(programExercise.targetSets, currentNumber) + extraRows;
  const bare = (weight: number) =>
    formatWeight(weight, unit, { decimals: 2, group: false, locale, withUnit: false });
  // Same formatting as the confirmed rows, so a picked value reads identically
  // before and after logging.
  const displayWeight = bare(draft.weight);
  const availableWeights = useMemo(() => {
    const constrained = gymWeightOptions(pickerLoadConstraints, pickerReferenceWeight);
    if (constrained.length > 0) return constrained;
    const step = programExercise.exercise.category === 'ISOLATION' ? 1 : 2.5;
    return Array.from({ length: 81 }, (_, index) => +(index * step).toFixed(2));
  }, [pickerLoadConstraints, pickerReferenceWeight, programExercise.exercise.category]);
  const repOptions = useMemo(() => Array.from({ length: 30 }, (_, index) => index + 1), []);
  const weightPickerOptions = useMemo(
    () =>
      availableWeights.map((weight) => ({
        value: unit === 'LB' ? roundWeight(toDisplayWeight(weight, unit), 2) : weight,
        canonicalValue: weight,
        label: formatWeight(weight, unit, {
          decimals: 2,
          group: false,
          locale,
          withUnit: false,
        }),
      })),
    [availableWeights, locale, unit],
  );
  const repPickerOptions = useMemo(() => repOptions.map((value) => ({ value })), [repOptions]);
  const recommendationKey = recommendation
    ? `${recommendation.weight}:${recommendation.reps}:${recommendation.rir}`
    : null;
  const canApplyRecommendation =
    recommendation != null && appliedRecommendationKey !== recommendationKey;

  function applyRecommendation() {
    if (!recommendation || disabled) return;
    setEditingSet(null);
    setPicker(null);
    setDraft({ weight: recommendation.weight, reps: recommendation.reps, rir: recommendation.rir });
    setAppliedRecommendationKey(recommendationKey);
  }

  function openPicker(kind: 'weight' | 'reps', set?: PendingSet) {
    if (set && editingSet?.set.localId !== set.localId) {
      setEditingSet({ set, draft: { weight: set.weight, reps: set.reps, rir: set.rir } });
    } else if (!set) {
      setEditingSet(null);
    }
    setPicker(kind);
  }

  function openRir(set?: PendingSet) {
    if (set && editingSet?.set.localId !== set.localId) {
      setEditingSet({ set, draft: { weight: set.weight, reps: set.reps, rir: set.rir } });
    } else if (!set) {
      setEditingSet(null);
    }
    setPicker(null);
    setRirTarget({ set });
  }

  function chooseValue(value: number, canonicalWeight?: number) {
    const updateDraft = (current: DraftSet): DraftSet =>
      picker === 'weight'
        ? { ...current, weight: canonicalWeight ?? fromDisplayWeight(value, unit) }
        : { ...current, reps: Math.max(1, Math.round(value)) };
    if (editingSet) {
      const nextDraft = updateDraft(editingSet.draft);
      setPicker(null);
      void persistEditedSet(editingSet.set, nextDraft);
      return;
    }
    setDraft(updateDraft);
    setAppliedRecommendationKey(null);
    setPicker(null);
  }

  async function persistEditedSet(set: PendingSet, nextDraft: DraftSet) {
    if (disabled || updatingSetId === set.localId || nextDraft.reps <= 0 || nextDraft.weight < 0)
      return;
    // Only a weight the lifter actually changed is snapped, and against the
    // set's own equipment. An edit of reps or RIR leaves the stored weight as is.
    const normalized =
      nextDraft.weight === set.weight
        ? nextDraft
        : {
            ...nextDraft,
            weight: constrainGymWeight(
              nextDraft.weight,
              nextDraft.weight,
              loadConstraintsForSet(set),
            ),
          };
    setEditingSet({ set, draft: normalized });
    setUpdatingSetId(set.localId);
    try {
      await onUpdateSet(set, normalized);
      setEditingSet(null);
    } catch {
      setEditingSet(null);
    } finally {
      setUpdatingSetId(null);
    }
  }

  function updateEditingRir(set: PendingSet, rir: number | null) {
    const current =
      editingSet?.set.localId === set.localId
        ? editingSet.draft
        : { weight: set.weight, reps: set.reps, rir: set.rir };
    void persistEditedSet(set, { ...current, rir });
  }

  function resetNextOptions() {
    setNextType('WORKING');
    setNextRpe(null);
    setNextNotes('');
    setOptionsOpen(false);
  }

  const canConfirm = !disabled && !submitting && draft.reps > 0 && draft.weight >= 0;

  async function confirmRow() {
    if (disabled || submitting || draft.reps <= 0 || draft.weight < 0) return;
    setSubmitting(true);
    try {
      const kind = resolveSetType({ type: nextType });
      await onSubmit({
        weight: constrainGymWeight(draft.weight, draft.weight, effectiveLoadConstraints),
        reps: draft.reps,
        rir: draft.rir,
        durationSec: null,
        distanceM: null,
        isWarmup: kind.isWarmup,
        isDropSet: kind.isDropSet,
        notes: nextNotes.trim() || null,
        gymEquipmentId: gymEquipmentId || null,
        type: kind.type,
        rpe: nextRpe,
      });
      resetNextOptions();
    } finally {
      setSubmitting(false);
    }
  }

  // The footer's "Log set N" runs this very confirmation.
  useImperativeHandle(actionRef, () => ({ confirm: confirmRow }));

  // Keep the footer's label in step with the row ("Log set 2", "82.5 × 7").
  const reportCurrent = useRef(onCurrentSetChange);
  reportCurrent.current = onCurrentSetChange;
  const nextIsWarmup = resolveSetType({ type: nextType }).isWarmup;
  useEffect(() => {
    reportCurrent.current?.({
      number: currentNumber,
      weight: draft.weight,
      reps: draft.reps,
      isWarmup: nextIsWarmup,
      canConfirm,
    });
  }, [currentNumber, draft.weight, draft.reps, nextIsWarmup, canConfirm]);

  // One tap logs a suggested ramp step as a WARMUP set (outside the working
  // set numbering, like any warm-up), on the selected equipment.
  async function logWarmup(step: WarmupSuggestion) {
    if (disabled || submitting) return;
    setSubmitting(true);
    try {
      const kind = resolveSetType({ type: 'WARMUP' });
      await onSubmit({
        weight: constrainGymWeight(step.weightKg, step.weightKg, effectiveLoadConstraints),
        reps: step.reps,
        rir: null,
        durationSec: null,
        distanceM: null,
        isWarmup: kind.isWarmup,
        isDropSet: kind.isDropSet,
        notes: null,
        gymEquipmentId: gymEquipmentId || null,
        type: kind.type,
        rpe: null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const optionsSummary = [
    nextType !== 'WORKING'
      ? t(
          `setTypes.${SET_TYPE_OPTIONS.find((o) => o.type === nextType)?.key ?? ('other' as const)}`,
        )
      : null,
    nextRpe != null ? `RPE ${nextRpe}` : null,
    nextNotes.trim() ? t('options.notes') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // The RIR sheet edits either a logged set or the next one.
  function chooseRir(value: number | null) {
    const target = rirTarget;
    setRirTarget(null);
    if (!target) return;
    if (target.set) {
      updateEditingRir(target.set, value);
      return;
    }
    setDraft((current) => ({ ...current, rir: value }));
    setAppliedRecommendationKey(null);
  }

  const rirPickerValue = rirTarget?.set
    ? editingSet?.set.localId === rirTarget.set.localId
      ? editingSet.draft.rir
      : rirTarget.set.rir
    : draft.rir;

  const hasMetrics = metrics.length > 0;
  // Working rows are 76px; with the calculated line under them the line takes
  // part of that height.
  const workingRowHeight = hasMetrics ? 'h-[4.25rem]' : 'h-[4.75rem]';
  const warmupTag = (
    <Tag variant="warmup" title={t('setTypes.warmup')} className="h-6 min-w-6 justify-center px-1">
      {t('warmupTag')}
    </Tag>
  );

  // The calculated line (1RM, 10RM, volume) under a working row.
  function metricsRow(
    values: DraftSet,
    testId: (metric: SetTableMetric) => string,
    current: boolean,
  ) {
    if (!hasMetrics) return null;
    return (
      <tr className={cn(current && 'bg-row-current')}>
        <td />
        <td colSpan={3} className="pb-2 text-center text-small tabular-nums text-muted-foreground">
          <span className="inline-flex flex-wrap justify-center gap-x-3">
            {metrics.map((metric) => (
              <span key={metric}>
                <span data-testid={current ? `set-metric-header-${metric}` : undefined}>
                  {metricLabel(metric, true)}
                </span>{' '}
                <span data-testid={testId(metric)}>{formatMetric(metric, values)}</span>
              </span>
            ))}
          </span>
        </td>
        <td />
      </tr>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {equipmentOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inline-gym-equipment" className="text-caption font-semibold">
            {inputT('equipment')}
          </label>
          <div className="flex gap-2">
            <Select
              value={gymEquipmentId || 'none'}
              disabled={disabled}
              onValueChange={(value) => setGymEquipmentId(value === 'none' ? '' : value)}
            >
              <SelectTrigger id="inline-gym-equipment" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{inputT('equipmentNone')}</SelectItem>
                {equipmentOptions.map((equipment) => (
                  <SelectItem key={equipment.id} value={equipment.id}>
                    {equipment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEditSelectedEquipment && (
              <IconButton
                type="button"
                tone="outline"
                disabled={disabled}
                onClick={() => setWeightEditorOpen(true)}
                aria-label={t('weightEditor.open')}
                title={t('weightEditor.open')}
              >
                <PencilSimpleIcon />
              </IconButton>
            )}
          </div>
        </div>
      )}
      {gymId && selectedEquipment && canEditSelectedEquipment && (
        <LiveEquipmentWeightEditor
          open={weightEditorOpen}
          gymId={gymId}
          equipment={selectedEquipment}
          unit={unit}
          onOpenChange={setWeightEditorOpen}
          onSaved={(equipment) => onEquipmentWeightsUpdated?.(equipment)}
        />
      )}

      <table
        data-testid="editable-sets-grid"
        className="-mx-3 w-[calc(100%+1.5rem)] table-fixed border-collapse"
      >
        <caption className="sr-only">{t('title')}</caption>
        <thead>
          <tr className="h-8 text-center text-small font-semibold text-muted-foreground">
            <th scope="col" className="w-11 pl-2 font-semibold">
              {t('columns.set')}
            </th>
            <th scope="col" className="font-semibold">
              {unitLabel(unit)}
            </th>
            <th scope="col" className="font-semibold">
              {t('columns.reps')}
            </th>
            <th scope="col" className="font-semibold">
              {t('columns.rir')}
            </th>
            <th scope="col" className="w-[4.75rem] pr-2">
              <span className="sr-only">{t('columns.done')}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('metrics.open')}
                    title={t('metrics.open')}
                    className="-my-2 ml-auto flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <SlidersHorizontalIcon className="size-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('metrics.label')}</DropdownMenuLabel>
                  {SET_TABLE_METRICS.map((metric) => (
                    <DropdownMenuCheckboxItem
                      key={metric}
                      checked={metrics.includes(metric)}
                      disabled={metrics.length === 1 && metrics[0] === metric}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(checked) => updateMetric(metric, checked === true)}
                    >
                      {metricLabel(metric)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </th>
          </tr>
        </thead>

        {/* Warm-ups: logged ones are done (the check takes one back), the
            suggested ramp steps are one tap from being logged. */}
        {(warmupSets.length > 0 || warmupSuggestions.length > 0) && (
          <tbody data-testid="warmup-sets">
            {warmupSets.map((set, index) => (
              <tr key={set.localId} className="h-16 border-t border-border">
                <td className="pl-2 text-center">{warmupTag}</td>
                <StaticCell value={bare(set.weight)} tone="done" />
                <StaticCell value={String(set.reps)} tone="done" />
                <StaticCell value={set.rir == null ? '–' : String(set.rir)} tone="done" />
                <td className="pl-1 pr-2">
                  <SetCheck
                    done
                    disabled={disabled}
                    onClick={() => void onDeleteSet(set)}
                    aria-label={t('deleteWarmup', { number: index + 1 })}
                    title={t('deleteWarmup', { number: index + 1 })}
                  />
                </td>
              </tr>
            ))}
            {warmupSuggestions.map((step) => {
              const weight = formatWeight(step.weightKg, unit, {
                decimals: 2,
                group: false,
                locale,
              });
              return (
                <tr
                  key={`suggested-${step.weightKg}-${step.reps}`}
                  className="h-16 border-t border-border"
                >
                  <td className="pl-2 text-center">{warmupTag}</td>
                  <StaticCell value={bare(step.weightKg)} tone="pending" />
                  <StaticCell value={String(step.reps)} tone="pending" />
                  <StaticCell value="–" tone="pending" />
                  <td className="pl-1 pr-2">
                    <SetCheck
                      done={false}
                      disabled={disabled || submitting}
                      onClick={() => void logWarmup(step)}
                      aria-label={t('logWarmup', { weight, reps: step.reps })}
                      title={t('logWarmupHint', { percent: step.percent })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}

        <tbody>
          {workingSets.map((set, setIndex) => {
            const isEditing = editingSet?.set.localId === set.localId;
            const rowDraft = isEditing
              ? editingSet.draft
              : { weight: set.weight, reps: set.reps, rir: set.rir };
            const isUpdating = updatingSetId === set.localId;
            const prs = prsFor(set, setIndex);
            const isLatest = set.localId === latestWorkingSetId;
            const weightText = bare(rowDraft.weight);
            const checkLabel = isLatest
              ? t('undo', { number: set.setNumber })
              : t('delete', { number: set.setNumber });
            return (
              // A logged row and its calculated line, kept together.
              <Fragment key={set.localId}>
                <tr className={cn(workingRowHeight, 'border-t border-border')}>
                  <td className="pl-2 text-center">
                    <span className="inline-flex flex-col items-center gap-[3px]">
                      <SetLabel>{set.setNumber}</SetLabel>
                      {prs.length > 0 && (
                        <Highlight
                          stretch={100}
                          className="px-1 py-px text-[0.625rem] font-bold leading-tight"
                          title={prs
                            .map((pr) => prT(pr === 'weight' ? 'weightPrTitle' : 'oneRmPrTitle'))
                            .join(' · ')}
                        >
                          <span aria-hidden>{t('pr')}</span>
                          {prs.map((pr) => (
                            <span key={pr} className="sr-only">
                              {prT(pr === 'weight' ? 'weightPr' : 'oneRmPr')}
                            </span>
                          ))}
                        </Highlight>
                      )}
                    </span>
                  </td>
                  <td className="px-1">
                    <SetCell
                      tone="done"
                      disabled={disabled || isUpdating}
                      onClick={() => openPicker('weight', set)}
                      aria-label={t('weight', { number: set.setNumber, unit })}
                      className={cn(CELL_HIT_AREA, cellTextSize(weightText))}
                    >
                      {weightText}
                    </SetCell>
                  </td>
                  <td className="px-1">
                    <SetCell
                      tone="done"
                      disabled={disabled || isUpdating}
                      onClick={() => openPicker('reps', set)}
                      aria-label={t('reps', { number: set.setNumber })}
                      className={cn(CELL_HIT_AREA, cellTextSize(String(rowDraft.reps)))}
                    >
                      {rowDraft.reps}
                    </SetCell>
                  </td>
                  <td className="px-1">
                    <SetCell
                      tone="done"
                      disabled={disabled || isUpdating}
                      onClick={() => openRir(set)}
                      aria-label={t('rir', { number: set.setNumber })}
                      className={cn(CELL_HIT_AREA, cellTextSize('0'))}
                    >
                      {rowDraft.rir == null ? '–' : rowDraft.rir}
                    </SetCell>
                  </td>
                  <td className="pl-1 pr-2">
                    {isUpdating ? (
                      <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <CircleNotchIcon className="size-6 motion-safe:animate-spin" />
                      </span>
                    ) : (
                      // A logged set: the filled check takes it back (undo for
                      // the latest, delete for an older one), through the outbox.
                      <SetCheck
                        done
                        onClick={() => void onDeleteSet(set)}
                        aria-label={checkLabel}
                        title={checkLabel}
                      />
                    )}
                  </td>
                </tr>
                {metricsRow(
                  rowDraft,
                  (metric) => `completed-set-${set.setNumber}-metric-${metric}`,
                  false,
                )}
              </Fragment>
            );
          })}

          {/* The set being logged: lit, its fields white, prefilled with the
              suggestion and confirmed with the round check (or the footer). */}
          <tr
            data-testid="current-set-row"
            className={cn(workingRowHeight, 'border-t border-border bg-row-current')}
          >
            <td className="pl-2 text-center">
              {recommendation ? (
                <button
                  type="button"
                  onClick={applyRecommendation}
                  disabled={disabled || !canApplyRecommendation}
                  aria-label={t('applyRecommendation', { number: currentNumber })}
                  title={t('applyRecommendation', { number: currentNumber })}
                  className="relative mx-auto flex size-11 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                >
                  <SetLabel>{currentNumber}</SetLabel>
                  {canApplyRecommendation && (
                    <span
                      data-testid="set-recommendation-dot"
                      aria-hidden
                      className="absolute right-1 top-1 size-2 rounded-[2px] bg-brand"
                    />
                  )}
                </button>
              ) : (
                <SetLabel>{currentNumber}</SetLabel>
              )}
            </td>
            <td className="px-1">
              <SetCell
                tone="current"
                onClick={() => openPicker('weight')}
                aria-label={t('weight', { number: currentNumber, unit })}
                className={cn(CELL_HIT_AREA, cellTextSize(displayWeight))}
              >
                {displayWeight}
              </SetCell>
            </td>
            <td className="px-1">
              <SetCell
                tone="current"
                onClick={() => openPicker('reps')}
                aria-label={t('reps', { number: currentNumber })}
                className={cn(CELL_HIT_AREA, cellTextSize(String(draft.reps)))}
              >
                {draft.reps}
              </SetCell>
            </td>
            <td className="px-1">
              <SetCell
                tone="current"
                onClick={() => openRir()}
                aria-label={t('rir', { number: currentNumber })}
                className={cn(CELL_HIT_AREA, cellTextSize('0'))}
              >
                {draft.rir == null ? '–' : draft.rir}
              </SetCell>
            </td>
            <td className="pl-1 pr-2">
              <SetCheck
                done={false}
                onClick={() => void confirmRow()}
                disabled={!canConfirm}
                aria-busy={submitting || undefined}
                aria-label={t('confirm', { number: currentNumber })}
              />
            </td>
          </tr>
          {metricsRow(draft, (metric) => `active-set-metric-${metric}`, true)}

          {/* Sets still to come, with last session's numbers as a reference. */}
          {Array.from({ length: Math.max(0, totalRows - currentNumber) }, (_, index) => {
            const rowNumber = currentNumber + index + 1;
            const previous = lastPerformance?.sets[rowNumber - 1];
            return (
              <tr key={`upcoming-${rowNumber}`} className="h-[4.75rem] border-t border-border">
                <td className="pl-2 text-center text-muted-foreground">
                  <SetLabel>{rowNumber}</SetLabel>
                </td>
                <StaticCell value={previous ? bare(previous.weight) : '–'} tone="pending" />
                <StaticCell value={previous ? String(previous.reps) : '–'} tone="pending" />
                <StaticCell
                  value={previous?.rir != null ? String(previous.rir) : '–'}
                  tone="pending"
                />
                <td className="pl-1 pr-2">
                  <span
                    aria-hidden
                    className="flex size-16 items-center justify-center rounded-full border-[1.5px] border-input bg-card text-input"
                  >
                    <CheckIcon className="size-[26px]" />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="-mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExtraRows((count) => count + 1)}
          disabled={disabled}
          className="flex h-12 items-center gap-2 rounded-sm text-[0.9375rem] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <PlusIcon className="size-4" />
          {t('addSet')}
        </button>
        <button
          type="button"
          onClick={() => setOptionsOpen((open) => !open)}
          aria-expanded={optionsOpen}
          aria-controls="next-set-options"
          disabled={disabled}
          className="flex h-12 min-w-0 items-center gap-2 rounded-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <span className="text-caption font-semibold">{t('options.toggle')}</span>
          {optionsSummary && (
            <span className="truncate text-small text-muted-foreground">{optionsSummary}</span>
          )}
          <CaretDownIcon
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-[120ms] ease-out-quart motion-reduce:transition-none',
              optionsOpen && 'rotate-180',
            )}
          />
        </button>
      </div>
      {optionsOpen && (
        <div
          id="next-set-options"
          className="-mt-2 flex flex-col gap-4 border-t border-border pt-4"
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-caption font-semibold">{t('options.type')}</legend>
            <div className="flex flex-wrap gap-2">
              {SET_TYPE_OPTIONS.map((option) => (
                <FilterChip
                  key={option.type}
                  selected={nextType === option.type}
                  disabled={disabled}
                  onClick={() => setNextType(option.type)}
                >
                  {t(`setTypes.${option.key}`)}
                </FilterChip>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-[6.5rem_1fr] items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold">{t('options.rpe')}</span>
              <Select
                value={nextRpe == null ? 'none' : String(nextRpe)}
                disabled={disabled}
                onValueChange={(value) => setNextRpe(value === 'none' ? null : Number(value))}
              >
                <SelectTrigger aria-label={t('options.rpe')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('options.rpeNone')}</SelectItem>
                  {RPE_VALUES.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="next-set-notes" className="text-caption font-semibold">
                {t('options.notes')}
              </label>
              <Input
                id="next-set-notes"
                value={nextNotes}
                maxLength={500}
                disabled={disabled}
                placeholder={t('options.notesPlaceholder')}
                onChange={(event) => setNextNotes(event.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <SetValuePicker
        open={picker != null}
        kind={picker ?? 'weight'}
        value={
          picker === 'reps'
            ? (editingSet?.draft.reps ?? draft.reps)
            : unit === 'LB'
              ? roundWeight(toDisplayWeight(editingSet?.draft.weight ?? draft.weight, unit), 1)
              : (editingSet?.draft.weight ?? draft.weight)
        }
        canonicalValue={picker === 'reps' ? undefined : (editingSet?.draft.weight ?? draft.weight)}
        options={picker === 'reps' ? repPickerOptions : weightPickerOptions}
        unit={unit}
        loadConstraints={pickerLoadConstraints}
        onClose={() => setPicker(null)}
        onChoose={chooseValue}
      />
      <RirPicker
        open={rirTarget != null}
        value={rirPickerValue}
        onClose={() => setRirTarget(null)}
        onChoose={chooseRir}
      />
    </section>
  );
}

// The set number in the first column, in the sheet's widened number style.
function SetLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center px-1 font-num text-[0.8125rem] font-semibold tabular-nums stretch-112">
      {children}
    </span>
  );
}

// A value that cannot be tapped (a warm-up, a set still to come): the cell's
// look without the button.
function StaticCell({ value, tone }: { value: string; tone: 'done' | 'pending' }) {
  return (
    <td className="px-1">
      <span
        className={cn(
          'flex h-12 w-full items-center justify-center font-num font-semibold tabular-nums stretch-118',
          cellTextSize(value),
          tone === 'done' ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {value}
      </span>
    </td>
  );
}
