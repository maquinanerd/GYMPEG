'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckIcon,
  CaretDownIcon,
  CaretUpIcon,
  CircleNotchIcon,
  PencilSimpleIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
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
import { Chip } from '@/components/ui/chip';
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
    if (previous.id !== programExercise.id) resetNextOptions();
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
  const totalRows = Math.max(programExercise.targetSets, currentNumber);
  // Same formatting as the confirmed rows, so a picked value reads identically
  // before and after logging.
  const displayWeight = formatWeight(draft.weight, unit, {
    decimals: 2,
    group: false,
    locale,
    withUnit: false,
  });
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

  return (
    <section className="flex flex-col gap-5">
      {equipmentOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inline-gym-equipment" className="text-caption text-muted-foreground">
            {inputT('equipment')}
          </label>
          <div className="flex gap-2">
            <Select
              value={gymEquipmentId || 'none'}
              disabled={disabled}
              onValueChange={(value) => setGymEquipmentId(value === 'none' ? '' : value)}
            >
              <SelectTrigger id="inline-gym-equipment" className="h-12 flex-1 rounded-pill">
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

      {/* Warm-up ramp: suggested steps are outlined (a tap logs one), logged
          ones are filled (a tap removes it again). */}
      {(warmupSets.length > 0 || warmupSuggestions.length > 0) && (
        <div data-testid="warmup-sets" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-subtitle">{t('warmups')}</h3>
            <span className="text-small text-muted-foreground">{t('warmupHint')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {warmupSets.map((set, index) => (
              <button
                key={set.localId}
                type="button"
                disabled={disabled}
                onClick={() => void onDeleteSet(set)}
                aria-label={t('deleteWarmup', { number: index + 1 })}
                className="flex h-16 min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-pill border-[1.5px] border-warmup bg-warmup text-warmup-foreground tabular-nums transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="text-subtitle">
                  {formatWeight(set.weight, unit, { decimals: 2, group: false, locale })}
                </span>{' '}
                <span className="text-small">× {set.reps}</span>
              </button>
            ))}
            {warmupSuggestions.map((step) => {
              const weight = formatWeight(step.weightKg, unit, {
                decimals: 2,
                group: false,
                locale,
              });
              return (
                <button
                  key={`suggested-${step.weightKg}-${step.reps}`}
                  type="button"
                  disabled={disabled || submitting}
                  onClick={() => void logWarmup(step)}
                  aria-label={t('logWarmup', { weight, reps: step.reps })}
                  title={t('logWarmupHint', { percent: step.percent })}
                  className="flex h-16 min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-pill border-[1.5px] border-warmup bg-transparent text-foreground tabular-nums transition-colors hover:bg-warmup/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <span className="text-subtitle">{weight}</span>{' '}
                  <span className="text-small">× {step.reps}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-subtitle">{t('title')}</h3>
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-small text-muted-foreground">{t('tapToAdjust')}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('metrics.open')}
                  title={t('metrics.open')}
                  className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>
        </div>
        {/* The calculated columns the lifter picked, read under each row. */}
        <div className="-mt-1 flex gap-2 text-small text-muted-foreground" aria-hidden>
          {metrics.map((metric) => (
            <span key={metric} data-testid={`set-metric-header-${metric}`}>
              {metricLabel(metric)}
            </span>
          ))}
        </div>

        <div data-testid="editable-sets-grid" className="flex flex-col gap-2">
          {workingSets.map((set, setIndex) => {
            const isEditing = editingSet?.set.localId === set.localId;
            const rowDraft = isEditing
              ? editingSet.draft
              : { weight: set.weight, reps: set.reps, rir: set.rir };
            const isUpdating = updatingSetId === set.localId;
            const prs = prsFor(set, setIndex);
            const isLatest = set.localId === latestWorkingSetId;
            return (
              <div key={set.localId} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 rounded-[26px] border-[1.5px] border-transparent p-[5px]">
                  <SetNumber state="done">{set.setNumber}</SetNumber>
                  <ValueField
                    value={formatWeight(rowDraft.weight, unit, {
                      decimals: 2,
                      group: false,
                      locale,
                      withUnit: false,
                    })}
                    caption={unitLabel(unit)}
                    disabled={disabled || isUpdating}
                    onClick={() => openPicker('weight', set)}
                    aria-label={t('weight', { number: set.setNumber, unit })}
                  />
                  <ValueField
                    value={String(rowDraft.reps)}
                    caption={t('repsShort')}
                    disabled={disabled || isUpdating}
                    onClick={() => openPicker('reps', set)}
                    aria-label={t('reps', { number: set.setNumber })}
                  />
                  <ValueField
                    value={rowDraft.rir == null ? '–' : String(rowDraft.rir)}
                    caption="RIR"
                    disabled={disabled || isUpdating}
                    onClick={() => openRir(set)}
                    aria-label={t('rir', { number: set.setNumber })}
                  />
                  {isUpdating ? (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CircleNotchIcon className="size-6 motion-safe:animate-spin" />
                    </span>
                  ) : (
                    // A logged set: the filled check takes it back (undo for the
                    // latest, delete for an older one), through the outbox.
                    <button
                      type="button"
                      onClick={() => void onDeleteSet(set)}
                      aria-label={
                        isLatest
                          ? t('undo', { number: set.setNumber })
                          : t('delete', { number: set.setNumber })
                      }
                      title={
                        isLatest
                          ? t('undo', { number: set.setNumber })
                          : t('delete', { number: set.setNumber })
                      }
                      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <CheckIcon className="size-7" />
                    </button>
                  )}
                </div>
                {(prs.length > 0 || metrics.length > 0) && (
                  <div className="ml-[39px] flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {prs.map((pr) => (
                      <Tag
                        key={pr}
                        fill="pr"
                        icon={TrophyIcon}
                        title={prT(pr === 'weight' ? 'weightPrTitle' : 'oneRmPrTitle')}
                      >
                        {prT(pr === 'weight' ? 'weightPr' : 'oneRmPr')}
                      </Tag>
                    ))}
                    {metrics.map((metric) => (
                      <span key={metric} className="text-small text-muted-foreground tabular-nums">
                        {metricLabel(metric, true)}{' '}
                        <span data-testid={`completed-set-${set.setNumber}-metric-${metric}`}>
                          {formatMetric(metric, rowDraft)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* The set being logged: prefilled with the suggestion, outlined in
              lime, confirmed with the round button. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 rounded-[26px] border-[1.5px] border-primary p-[5px]">
              {recommendation ? (
                <button
                  type="button"
                  onClick={applyRecommendation}
                  disabled={disabled || !canApplyRecommendation}
                  aria-label={t('applyRecommendation', { number: currentNumber })}
                  title={t('applyRecommendation', { number: currentNumber })}
                  className="relative -m-2 flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                >
                  <SetNumber state="current">{currentNumber}</SetNumber>
                  {canApplyRecommendation && (
                    <span
                      data-testid="set-recommendation-dot"
                      aria-hidden
                      className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-card"
                    />
                  )}
                </button>
              ) : (
                <SetNumber state="current">{currentNumber}</SetNumber>
              )}
              <ValueField
                value={displayWeight}
                caption={unitLabel(unit)}
                onClick={() => openPicker('weight')}
                aria-label={t('weight', { number: currentNumber, unit })}
              />
              <ValueField
                value={String(draft.reps)}
                caption={t('repsShort')}
                onClick={() => openPicker('reps')}
                aria-label={t('reps', { number: currentNumber })}
              />
              <ValueField
                value={draft.rir == null ? '–' : String(draft.rir)}
                caption="RIR"
                onClick={() => openRir()}
                aria-label={t('rir', { number: currentNumber })}
              />
              <button
                type="button"
                onClick={confirmRow}
                disabled={disabled || submitting || draft.reps <= 0}
                aria-label={t('confirm', { number: currentNumber })}
                className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 bg-card text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {submitting ? (
                  <CircleNotchIcon className="size-6 motion-safe:animate-spin" />
                ) : (
                  <CheckIcon className="size-7" />
                )}
              </button>
            </div>
            {metrics.length > 0 && (
              <div className="ml-[39px] flex flex-wrap gap-x-3 text-small text-muted-foreground tabular-nums">
                {metrics.map((metric) => (
                  <span key={metric}>
                    {metricLabel(metric, true)}{' '}
                    <span data-testid={`active-set-metric-${metric}`}>
                      {formatMetric(metric, draft)}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sets still to come, with last session's numbers as a reference. */}
          {Array.from({ length: Math.max(0, totalRows - currentNumber) }, (_, index) => {
            const rowNumber = currentNumber + index + 1;
            const previous = lastPerformance?.sets[rowNumber - 1];
            return (
              <div
                key={`upcoming-${rowNumber}`}
                className="flex items-center gap-1.5 rounded-[26px] border-[1.5px] border-transparent p-[5px] text-muted-foreground"
              >
                <SetNumber state="upcoming">{rowNumber}</SetNumber>
                <ValueField
                  muted
                  value={
                    previous
                      ? formatWeight(previous.weight, unit, {
                          decimals: 2,
                          group: false,
                          locale,
                          withUnit: false,
                        })
                      : '–'
                  }
                  caption={unitLabel(unit)}
                />
                <ValueField muted value={previous ? String(previous.reps) : '–'} caption={t('repsShort')} />
                <ValueField
                  muted
                  value={previous?.rir != null ? String(previous.rir) : '–'}
                  caption="RIR"
                />
                <span
                  aria-hidden
                  className="size-16 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/25"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setOptionsOpen((open) => !open)}
          aria-expanded={optionsOpen}
          aria-controls="next-set-options"
          disabled={disabled}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-pill text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <span className="text-caption font-semibold">{t('options.toggle')}</span>
          <span className="flex items-center gap-2 text-muted-foreground">
            {optionsSummary && <span className="text-small">{optionsSummary}</span>}
            {optionsOpen ? (
              <CaretUpIcon className="size-4" />
            ) : (
              <CaretDownIcon className="size-4" />
            )}
          </span>
        </button>
        {optionsOpen && (
          <div
            id="next-set-options"
            className="flex flex-col gap-4 rounded border border-border bg-card p-4"
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-caption text-muted-foreground">{t('options.type')}</legend>
              <div className="flex flex-wrap gap-2">
                {SET_TYPE_OPTIONS.map((option) => (
                  <Chip
                    key={option.type}
                    selected={nextType === option.type}
                    disabled={disabled}
                    onClick={() => setNextType(option.type)}
                  >
                    {t(`setTypes.${option.key}`)}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-[6.5rem_1fr] items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-caption text-muted-foreground">{t('options.rpe')}</span>
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
                <label htmlFor="next-set-notes" className="text-caption text-muted-foreground">
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
      </div>

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

// Round set number: lime ring once logged, neutral for the current and the
// coming ones.
function SetNumber({
  state,
  children,
}: {
  state: 'done' | 'current' | 'upcoming';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-caption font-semibold tabular-nums',
        state === 'done'
          ? 'border-brand text-brand'
          : state === 'current'
            ? 'border-muted-foreground/40 text-foreground'
            : 'border-muted-foreground/25 text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

// One 64px value of a set row (load, reps, RIR): the number in the number
// style with its unit below. A button when it can be tapped to adjust.
function ValueField({
  value,
  caption,
  muted = false,
  onClick,
  disabled,
  'aria-label': ariaLabel,
}: {
  value: string;
  caption: string;
  muted?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          'leading-none tabular-nums',
          value.length > 5 ? 'text-heading' : 'text-number',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </span>
      <span className="text-small text-muted-foreground">{caption}</span>
    </>
  );
  const box = cn(
    'flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px]',
    muted ? 'bg-pill/60' : 'bg-pill',
  );
  if (!onClick) return <div className={box}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        box,
        'transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
      )}
    >
      {content}
    </button>
  );
}
