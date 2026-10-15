'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChatCircleTextIcon,
  DotsThreeVerticalIcon,
} from '@/components/ui/icon';
import type {
  Exercise,
  Program,
  ProgramExercise,
  Session,
  Set as PrismaSet,
  WeightUnit,
  Workout,
  Gym,
  GymExerciseConfig,
  EquipmentType,
  SetType,
} from '@/lib/prisma-client';
import { resolveSetType } from '@/lib/schemas/set';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Num } from '@/components/ui/num';
import { ProgressSegments } from '@/components/ui/progress-segments';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SyncStatus } from '@/components/offline/sync-status';
import { acquireWakeLock, bindWakeLockToVisibility, releaseWakeLock } from '@/lib/wake-lock';
import { vibrate, VIBRATION_PATTERNS } from '@/lib/vibrate';
import { generateLocalId, getDB, type PendingSet } from '@/lib/indexeddb';
import {
  READINESS_HOLD_AT_OR_BELOW,
  READINESS_RECENCY_HOURS,
  SORENESS_HOLD_AT_OR_ABOVE,
  readinessForSuggestion,
  type ReadinessSignal,
} from '@/lib/progression';
import { recommendNextIntraSet, type IntraSetRecommendation } from '@/lib/intra-set-autoregulation';
import {
  buildSupersetView,
  isSupersetTransitionRest,
  nextAutoAdvanceIndex,
  nextNavIndex,
  SUPERSET_TRANSITION_REST_SEC,
} from '@/lib/supersets';
import { WARMUP_REST_SEC } from '@/lib/warmup';
import { isReadinessAutoRegulationEnabled, isRestEndFlashEnabled } from '@/lib/preferences';
import { adjustRest, pauseRest, resumeRest } from '@/lib/rest-timer';
import {
  bindAutoSync,
  drainDroppedEquipment,
  flushPendingSets,
  onEquipmentDropped,
  pendingSetUpdateState,
  queueSet,
  queueSetDeletion,
  visibleSets,
} from '@/lib/sync';
import { hydrateFromServerSets } from '@/lib/sync-hydration';
import { finishSession, rememberSession, swapExerciseForSession } from '@/lib/session-lifecycle';
import { parseExerciseSwaps } from '@/lib/session-swaps';
import { offlineAwareHref } from '@/lib/offline-navigation';
import { formatWeight } from '@/lib/units';
import { ExerciseCard } from '@/components/session/exercise-card';
import {
  SessionExerciseMenu,
  type SessionCatalogExercise,
} from '@/components/session/session-exercise-menu';
import { SetsList } from '@/components/session/sets-list';
import {
  EditableSetsTable,
  type CurrentSetSummary,
  type EditableSetsTableHandle,
} from '@/components/session/editable-sets-table';
import type { LiveEquipmentOption } from '@/components/session/live-equipment-weight-editor';
import { SetInput } from '@/components/session/set-input';
import { RestTimer } from '@/components/session/rest-timer';
import { RestEndFlash } from '@/components/session/rest-end-flash';
import { SessionSummary } from '@/components/session/session-summary';
import { ReturnToTrainingNotice } from '@/components/session/return-to-training-notice';
import { SessionExerciseStrip } from '@/components/session/session-exercise-strip';
import { formatClock } from '@/components/session/session-format';
import { useExerciseName } from '@/components/shared/use-exercise-name';
import { useTrainingName } from '@/components/shared/use-training-name';
import { gymLoadConstraintsFor, type GymLoadConstraints } from '@/lib/gym-loads';
import type { ReturnRecommendation } from '@/lib/return-to-training';
import {
  exerciseDetailPath,
  selectedExerciseIndex,
  sessionExercisePath,
} from '@/lib/session-exercise-navigation';

export interface SerializedLastPerformance {
  sessionStartedAt: string;
  sets: { weight: number; reps: number; rir: number | null }[];
  maxWeight: number;
  repsAtMaxWeight: number;
  // Cardio totals for the last session (issue #176): null for strength
  // exercises. Carried so the exercise card can show a cardio "Last session"
  // reference (duration / distance / avgHr).
  cardio: { durationSec: number; distanceM: number; avgHr: number | null } | null;
}

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };
type SessionGymEquipment = {
  id: string;
  name: string;
  equipmentType: EquipmentType;
  weightOptions: number[];
  exerciseLinks: { exerciseId: string }[];
};

// In-session weight edits, valid for one server snapshot of the gym equipment.
type LiveEquipmentEdits = {
  base: SessionGymEquipment[] | undefined;
  equipment: Record<string, LiveEquipmentOption>;
  weightOptions: Record<string, number[]>;
};

export type SessionRunnerProps = {
  session: Session & {
    workout:
      | (Workout & {
          program: Pick<Program, 'id' | 'name'> | null;
          exercises: ProgramExerciseWithExercise[];
        })
      | null;
    sets: PrismaSet[];
    gym: (Gym & { exerciseConfigs: GymExerciseConfig[]; equipment: SessionGymEquipment[] }) | null;
  };
  lastPerformances: Record<string, SerializedLastPerformance>;
  returnRecommendations: Record<string, ReturnRecommendation>;
  // Latest in-window readiness check-in (or null). Drives whether the load
  // suggestion is held/reduced and the matching explainer in the UI.
  readiness: ReadinessSignal | null;
  // True while the user runs a planned deload week (issue #112): suggestions
  // step down and the runner shows a "Deload week" badge.
  deloadActive: boolean;
  unit: WeightUnit;
  initialProgramExerciseId?: string;
  catalog: SessionCatalogExercise[];
};

type Mode =
  | { kind: 'input' }
  | {
      kind: 'rest';
      endsAt: number;
      // Set while the rest is paused (issue #393); see lib/rest-timer.ts.
      pausedRemainingMs: number | null;
      totalSec: number;
      nextExerciseIdx: number | null;
      navigatedImmediately: boolean;
    }
  | { kind: 'summary' };

// What was just logged, for the rest screen's subtitle.
type LoggedSet = {
  exerciseName: string;
  setNumber: number;
  isWarmup: boolean;
  weight: number;
  reps: number;
};

export function SessionRunner({
  session,
  lastPerformances,
  returnRecommendations,
  readiness,
  deloadActive,
  unit,
  initialProgramExerciseId,
  catalog,
}: SessionRunnerProps) {
  const t = useTranslations('session');
  const cardT = useTranslations('session.exerciseCard');
  const restT = useTranslations('session.rest');
  const locale = useLocale();
  const exerciseName = useExerciseName();
  const trainingName = useTrainingName();
  const router = useRouter();
  const workout = session.workout!;
  // Weight edits made from this screen show at once, layered on the equipment
  // the server sent. They are tied to that server snapshot: once a refresh
  // delivers new props (the exercise menu triggers one), the server data, which
  // by then includes the saved edit, is the source again.
  const serverEquipment = session.gym?.equipment;
  const [liveEquipmentEdits, setLiveEquipmentEdits] = useState<LiveEquipmentEdits>({
    base: serverEquipment,
    equipment: {},
    weightOptions: {},
  });
  const activeEquipmentEdits =
    liveEquipmentEdits.base === serverEquipment ? liveEquipmentEdits : null;
  const sessionEquipment = useMemo<SessionGymEquipment[]>(
    () =>
      (serverEquipment ?? []).map((item) => {
        const edited = activeEquipmentEdits?.equipment[item.id];
        return edited ? { ...item, ...edited } : item;
      }),
    [serverEquipment, activeEquipmentEdits],
  );
  const liveWeightOptions = activeEquipmentEdits?.weightOptions;
  // Exercises replaced only for this session from this screen: shown at once,
  // online or not. The server applies its stored swaps to the props, so once
  // a refresh lands an entry here matches its row and changes nothing.
  const [localSwaps, setLocalSwaps] = useState<Record<string, SessionCatalogExercise>>({});
  const workoutExercises = useMemo(
    () =>
      workout.exercises.map((pe) => {
        const swap = localSwaps[pe.id];
        return swap && swap.id !== pe.exerciseId
          ? { ...pe, exerciseId: swap.id, exercise: swap as unknown as Exercise }
          : pe;
      }),
    [workout.exercises, localSwaps],
  );
  // Supersets (issue #146, slice 1): run the workout in presentation order -
  // members of a superset group come consecutively with A1/A2 labels. For a
  // workout without supersets this is exactly the stored order.
  const supersetView = useMemo(() => buildSupersetView(workoutExercises), [workoutExercises]);
  const programExercises = supersetView.ordered;

  const effectiveProgramExercises = useMemo<ProgramExerciseWithExercise[]>(
    () =>
      programExercises.map((pe) => {
        const recommendation = returnRecommendations[pe.id];
        if (!recommendation || recommendation.mode === 'normal') return pe;
        return {
          ...pe,
          targetSets: recommendation.targetSets,
          targetRIR: recommendation.targetRIR,
        };
      }),
    [programExercises, returnRecommendations],
  );
  const effectiveProgramExerciseById = useMemo(
    () => new Map(effectiveProgramExercises.map((pe) => [pe.id, pe])),
    [effectiveProgramExercises],
  );

  const initialExerciseIndex = selectedExerciseIndex(programExercises, initialProgramExerciseId);
  const [hydrated, setHydrated] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(initialExerciseIndex);
  // Removing an exercise shortens the list one render before the pending
  // selection below lands. Clamp instead of showing the empty state for that
  // pass: it would unmount the sets table and drop its parked drafts.
  const currentIdx = Math.min(selectedIdx, Math.max(programExercises.length - 1, 0));
  const [pendingExerciseSelection, setPendingExerciseSelection] = useState<{
    selectProgramExerciseId: string;
    removedProgramExerciseId?: string;
  } | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'input' });
  // The rest screen folded into a bar over the workout (the timer runs on).
  const [restMinimized, setRestMinimized] = useState(false);
  const [lastLogged, setLastLogged] = useState<LoggedSet | null>(null);
  // Bumped each time a rest runs out with the flash preference on (issue #393).
  const [restFlashCount, setRestFlashCount] = useState(0);
  const [closing, setClosing] = useState(false);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  // Readiness auto-regulation can be turned off in settings (issue #61). The
  // preference lives in localStorage, so it is read after mount; until then we
  // assume the default (on) so the first render matches the server output.
  const [autoRegulate, setAutoRegulate] = useState(true);
  // The footer's "Log set N" mirrors the row being logged and confirms it
  // through the sets table itself.
  const tableRef = useRef<EditableSetsTableHandle>(null);
  const [currentSet, setCurrentSet] = useState<CurrentSetSummary | null>(null);

  const currentPE = programExercises[currentIdx];
  const currentTarget = effectiveProgramExercises[currentIdx];

  // Write the clamp back. If a pending selection never lands (failed refresh,
  // target row gone), an index left past the end would make a later add jump
  // the view to the new row.
  useEffect(() => {
    if (selectedIdx !== currentIdx) setSelectedIdx(currentIdx);
  }, [selectedIdx, currentIdx]);

  useEffect(() => {
    if (!pendingExerciseSelection) return;
    if (
      pendingExerciseSelection.removedProgramExerciseId &&
      programExercises.some((item) => item.id === pendingExerciseSelection.removedProgramExerciseId)
    ) {
      return;
    }
    const refreshedIndex = programExercises.findIndex(
      (item) => item.id === pendingExerciseSelection.selectProgramExerciseId,
    );
    const target = programExercises[refreshedIndex];
    if (!target) return;
    // Same two steps as selectExercise: the URL keeps naming the selected
    // row, so a reload does not fall back to the first exercise.
    setSelectedIdx(refreshedIndex);
    window.history.replaceState(
      window.history.state,
      '',
      sessionExercisePath(session.id, target.id),
    );
    setPendingExerciseSelection(null);
  }, [pendingExerciseSelection, programExercises, session.id]);

  // When auto-regulation is off, the readiness signal is dropped entirely, so
  // the suggestion falls back to pure programmed progression (pre-#55 behavior).
  const effectiveReadiness = readinessForSuggestion(readiness, autoRegulate);

  // Equipment ids the server refused to attach during this session (issue
  // #326): the item was deleted, unlinked or moved. They are withdrawn from the
  // picker so the next set does not resend a reference that will be dropped.
  const [droppedEquipmentIds, setDroppedEquipmentIds] = useState<string[]>([]);

  // Hydrate IndexedDB with the server sets, then enable auto-sync.
  useEffect(() => {
    setAutoRegulate(isReadinessAutoRegulationEnabled());
    void (async () => {
      await hydrateFromServerSets(session.id, session.sets);
      setHydrated(true);
    })();
    // So a reload without a network can still run this session (offline page).
    void rememberSession({
      id: session.id,
      workoutId: session.workoutId,
      gymId: session.gymId,
      startedAt: new Date(session.startedAt).getTime(),
      exerciseSwaps: parseExerciseSwaps(session.exerciseSwaps),
    }).catch(() => undefined);
    void acquireWakeLock();
    const cleanupVisibility = bindWakeLockToVisibility();
    const cleanupSync = bindAutoSync();
    // The flush runs in the background, so a dropped equipment reference is
    // reported here rather than returned to handleValidate. The set itself is
    // saved; the user only learns that the machine was not recorded.
    //
    // Read from IndexedDB rather than from the broadcast payload, so a drop
    // discovered while this component was not mounted is still shown (#337).
    // Draining clears, so the mount call and the signal below cannot both
    // report the same set.
    const showDropped = async () => {
      const mine = await drainDroppedEquipment(session.id);
      if (mine.length === 0) return;
      setDroppedEquipmentIds((prev) => [
        ...new Set([...prev, ...mine.map((entry) => entry.gymEquipmentId)]),
      ]);
      toast.warning(t('equipmentDropped'));
    };
    // On mount: whatever a flush found while nobody was listening.
    void showDropped();
    const cleanupDropped = onEquipmentDropped(() => {
      void showDropped();
    });
    return () => {
      void releaseWakeLock();
      cleanupVisibility();
      cleanupSync();
      cleanupDropped();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live query: all sets of this session, from IndexedDB.
  const liveSets = useLiveQuery(
    async () => {
      const db = getDB();
      const items = visibleSets(
        await db.pendingSets.where('sessionId').equals(session.id).toArray(),
      );
      items.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId) || a.setNumber - b.setNumber);
      return items;
    },
    [session.id],
    [] as PendingSet[],
  );

  const setsByExercise = useMemo(() => {
    const out = new Map<string, PendingSet[]>();
    for (const s of liveSets) {
      if (!out.has(s.exerciseId)) out.set(s.exerciseId, []);
      out.get(s.exerciseId)!.push(s);
    }
    for (const arr of out.values()) {
      arr.sort((a, b) => a.setNumber - b.setNumber);
    }
    return out;
  }, [liveSets]);

  const programExerciseByExerciseId = useMemo(
    () => new Map(effectiveProgramExercises.map((pe) => [pe.exerciseId, pe])),
    [effectiveProgramExercises],
  );

  function recommendationFor(
    pe: ProgramExerciseWithExercise,
    atMs: number,
  ): IntraSetRecommendation | null {
    const completedSets = setsByExercise.get(pe.exerciseId) ?? [];
    const lastWorkingSet = completedSets.filter((set) => !set.isWarmup && !set.isDropSet).at(-1);
    if (!lastWorkingSet) return null;

    const interveningSet = liveSets
      .filter(
        (set) =>
          !set.isWarmup &&
          !set.isDropSet &&
          set.exerciseId !== pe.exerciseId &&
          set.createdAt > lastWorkingSet.createdAt,
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    const interveningPe = interveningSet
      ? programExerciseByExerciseId.get(interveningSet.exerciseId)
      : undefined;
    const sameMuscleSuperset = Boolean(
      interveningPe &&
      pe.supersetGroup != null &&
      interveningPe.supersetGroup === pe.supersetGroup &&
      interveningPe.exercise.muscleGroup === pe.exercise.muscleGroup,
    );

    const freshReadiness =
      effectiveReadiness != null && effectiveReadiness.ageHours <= READINESS_RECENCY_HOURS;
    const groupSoreness = effectiveReadiness?.soreness?.[pe.exercise.muscleGroup];
    const recoveryBlocksIncrease =
      freshReadiness &&
      (effectiveReadiness.readiness <= READINESS_HOLD_AT_OR_BELOW ||
        (typeof groupSoreness === 'number' && groupSoreness >= SORENESS_HOLD_AT_OR_ABOVE));
    const allowLoadIncrease = !deloadActive && !recoveryBlocksIncrease;

    return recommendNextIntraSet({
      programExercise: pe,
      completedSets,
      recoverySec: Math.max(0, (atMs - lastWorkingSet.createdAt) / 1000),
      sameMuscleSuperset,
      allowLoadIncrease,
      maxWeight: returnRecommendations[pe.id]?.weightCeiling ?? null,
      loadConstraints: loadConstraintsFor(pe),
    });
  }

  function loadConstraintsFor(pe: ProgramExerciseWithExercise): GymLoadConstraints | null {
    return gymLoadConstraintsFor(session.gym, pe.exercise, liveWeightOptions?.[pe.exerciseId]);
  }

  function handleEquipmentWeightsUpdated(equipment: LiveEquipmentOption) {
    setLiveEquipmentEdits((current) => {
      const edits =
        current.base === serverEquipment
          ? current
          : { base: serverEquipment, equipment: {}, weightOptions: {} };
      return {
        base: serverEquipment,
        equipment: { ...edits.equipment, [equipment.id]: equipment },
        weightOptions: {
          ...edits.weightOptions,
          ...Object.fromEntries(
            equipment.exerciseLinks.map((link) => [link.exerciseId, equipment.weightOptions]),
          ),
        },
      };
    });
  }

  // Prior-session sets per exercise, the PR baseline for the post-session
  // summary (same source as the in-session badge: getLastPerformances).
  const priorSetsByExercise = useMemo(() => {
    const out: Record<string, { weight: number; reps: number }[]> = {};
    for (const [exerciseId, perf] of Object.entries(lastPerformances)) {
      out[exerciseId] = perf.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
    }
    return out;
  }, [lastPerformances]);

  // Keyed by ProgramExercise row: a workout that programs the same exercise
  // twice shares one set pool (sets carry only exerciseId), so both rows read
  // the same count and each is complete once the pool covers its own target.
  const completedProgramExerciseIds = useMemo(() => {
    const completed = new Set<string>();
    for (const pe of effectiveProgramExercises) {
      const done = setsByExercise.get(pe.exerciseId)?.filter((s) => !s.isWarmup).length ?? 0;
      if (done >= pe.targetSets) completed.add(pe.id);
    }
    return completed;
  }, [effectiveProgramExercises, setsByExercise]);

  async function handleValidate(values: {
    weight: number;
    reps: number;
    rir: number | null;
    durationSec: number | null;
    distanceM: number | null;
    isWarmup: boolean;
    isDropSet: boolean;
    notes: string | null;
    gymEquipmentId?: string | null;
    type?: SetType;
    rpe?: number | null;
  }) {
    if (!currentPE || !currentTarget) return;
    const existing = setsByExercise.get(currentPE.exerciseId) ?? [];
    const setNumber = (existing.at(-1)?.setNumber ?? 0) + 1;
    // One source of truth for the kind of set: the legacy flags follow it.
    const kind = resolveSetType(values);

    // Optimistic write: immediate insert into IndexedDB (status pending),
    // instant display via useLiveQuery, and a background POST attempt.
    await queueSet({
      localId: generateLocalId(),
      sessionId: session.id,
      exerciseId: currentPE.exerciseId,
      gymEquipmentId: values.gymEquipmentId ?? null,
      setNumber,
      weight: values.weight,
      reps: values.reps,
      rir: values.rir,
      durationSec: values.durationSec,
      distanceM: values.distanceM,
      notes: values.notes,
      isWarmup: kind.isWarmup,
      isDropSet: kind.isDropSet,
      type: kind.type,
      rpe: values.rpe ?? null,
    });

    vibrate(VIBRATION_PATTERNS.validate);

    // Start the rest, preparing the auto-advance at the end of the timer.
    // Standalone exercise (unchanged behavior): advance once the set
    // completes the target. Superset member (issue #146): alternate to the
    // next member of the group that still has sets, the A1/A2 flow.
    const remainingAfterThisSet = (pe: ProgramExerciseWithExercise) => {
      const target = effectiveProgramExerciseById.get(pe.id) ?? pe;
      const logged = setsByExercise.get(pe.exerciseId)?.filter((s) => !s.isWarmup).length ?? 0;
      const justLogged = pe.exerciseId === currentPE.exerciseId ? 1 : 0;
      return target.targetSets - logged - justLogged;
    };
    const nextIdx = kind.isWarmup
      ? null
      : nextAutoAdvanceIndex(supersetView, currentIdx, remainingAfterThisSet);

    // Superset-aware rest (issue #189): a short transition rest when the
    // auto-advance moves to another member of the same group (A1 -> A2); the
    // full per-exercise rest after the last member and for standalone work.
    // A warm-up only needs time to change plates.
    const transition = isSupersetTransitionRest(supersetView, currentIdx, nextIdx);
    const restSec = kind.isWarmup
      ? Math.min(WARMUP_REST_SEC, currentTarget.restSec)
      : transition
        ? SUPERSET_TRANSITION_REST_SEC
        : currentTarget.restSec;

    setLastLogged({
      exerciseName: exerciseName(currentPE.exercise.name),
      setNumber: existing.filter((s) => !s.isWarmup).length + 1,
      isWarmup: kind.isWarmup,
      weight: values.weight,
      reps: values.reps,
    });

    // For a same-superset transition, show the next exercise immediately so
    // the lifter can get into position while the short transition rest runs.
    // The timer still keeps input locked until it ends or is skipped.
    const navigatedImmediately = transition && nextIdx != null;
    if (navigatedImmediately) selectExercise(nextIdx);

    setRestMinimized(false);
    setMode({
      kind: 'rest',
      endsAt: Date.now() + restSec * 1000,
      pausedRemainingMs: null,
      totalSec: restSec,
      nextExerciseIdx: nextIdx,
      navigatedImmediately,
    });
  }

  async function handleUpdateSet(
    set: PendingSet,
    values: { weight: number; reps: number; rir: number | null },
  ) {
    const db = getDB();
    try {
      let current = (await db.pendingSets.get(set.localId)) ?? set;
      if (current.status === 'syncing') {
        await flushPendingSets();
        current = (await db.pendingSets.get(set.localId)) ?? current;
      }
      const original = {
        weight: current.weight,
        reps: current.reps,
        rir: current.rir,
        status: current.status,
        attempts: current.attempts,
        lastError: current.lastError,
        serverId: current.serverId,
      };
      await db.pendingSets.update(set.localId, {
        weight: values.weight,
        reps: values.reps,
        rir: values.rir,
        status: 'pending',
        attempts: 0,
        lastError: null,
      });
      await flushPendingSets();
      const persisted = await db.pendingSets.get(set.localId);
      const updateState = pendingSetUpdateState(persisted);
      if (updateState === 'missing') {
        throw new Error('set disappeared after update');
      }
      if (updateState === 'failed') {
        await db.pendingSets.update(set.localId, original);
        throw new Error(persisted?.lastError ?? 'set update rejected');
      }
      if (updateState === 'synced') {
        toast.success(t('setUpdated'));
      } else {
        // A transient HTTP/network failure deliberately leaves the edit in the
        // local retry queue. Do not claim remote persistence until it syncs.
        toast.warning(t('setUpdateQueued'));
      }
    } catch (error) {
      toast.error(t('setUpdateError'));
      throw error;
    }
  }

  // The deletion goes through the outbox (works offline): the set disappears
  // now and the server is told when it can be reached.
  async function handleDeleteSet(set: PendingSet): Promise<boolean> {
    try {
      await queueSetDeletion(set.localId);
      toast.success(t('setDeleted'));
      return true;
    } catch {
      toast.error(t('setDeleteError'));
      return false;
    }
  }

  // Replaces the exercise of a row for this session only; the saved program
  // stays as it is. Online, a refresh then brings the new exercise's history.
  async function handleSwapForSession(programExerciseId: string, exercise: SessionCatalogExercise) {
    const { synced } = await swapExerciseForSession(
      {
        id: session.id,
        workoutId: session.workoutId,
        gymId: session.gymId,
        startedAt: new Date(session.startedAt).getTime(),
      },
      programExerciseId,
      exercise.id,
    );
    setLocalSwaps((current) => ({ ...current, [programExerciseId]: exercise }));
    if (synced) router.refresh();
  }

  async function handleFinishSession(notes: string | null) {
    setClosing(true);
    try {
      // The finish goes through the outbox (works offline). It reaches the
      // server only after every set of this session did, so queued sets are
      // never refused by an already closed session.
      const { synced } = await finishSession(
        {
          id: session.id,
          workoutId: session.workoutId,
          gymId: session.gymId,
          startedAt: new Date(session.startedAt).getTime(),
        },
        notes,
      );
      if (synced) toast.success(t('finished'));
      else toast.info(t('finishedOffline'));
      if (navigator.onLine) {
        router.replace('/');
        router.refresh();
      } else {
        // The home screen offline is the offline page's (precached).
        window.location.assign(offlineAwareHref('/'));
      }
    } catch {
      toast.error(t('finishError'));
    } finally {
      setClosing(false);
    }
  }

  function selectExercise(index: number) {
    const next = programExercises[index];
    if (!next) return;
    setSelectedIdx(index);
    window.history.replaceState(window.history.state, '', sessionExercisePath(session.id, next.id));
  }

  function handleRestEnd() {
    vibrate(VIBRATION_PATTERNS.restEnd);
    if (isRestEndFlashEnabled()) setRestFlashCount((count) => count + 1);
    if (mode.kind === 'rest' && !mode.navigatedImmediately && mode.nextExerciseIdx != null) {
      selectExercise(mode.nextExerciseIdx);
    }
    setMode({ kind: 'input' });
  }

  function handleSkipRest() {
    if (mode.kind === 'rest' && !mode.navigatedImmediately && mode.nextExerciseIdx != null) {
      selectExercise(mode.nextExerciseIdx);
    }
    setMode({ kind: 'input' });
  }

  function handlePauseRest() {
    if (mode.kind !== 'rest') return;
    setMode(pauseRest(mode, Date.now()));
  }

  function handleResumeRest() {
    if (mode.kind !== 'rest') return;
    setMode(resumeRest(mode, Date.now()));
  }

  function handleAdjustRest(deltaMs: number) {
    if (mode.kind !== 'rest') return;
    setMode(adjustRest(mode, deltaMs, Date.now()));
  }

  function goPrev() {
    selectExercise(Math.max(0, currentIdx - 1));
    setMode({ kind: 'input' });
  }
  // Next is linear for standalone exercises (unchanged) and cycles within a
  // superset group before advancing past it (issue #146).
  const remainingNow = (pe: ProgramExerciseWithExercise) => {
    const target = effectiveProgramExerciseById.get(pe.id) ?? pe;
    return (
      target.targetSets -
      (setsByExercise.get(pe.exerciseId)?.filter((s) => !s.isWarmup).length ?? 0)
    );
  };
  const navNextIdx = nextNavIndex(supersetView, currentIdx, remainingNow);
  function goNext() {
    if (navNextIdx == null) return;
    selectExercise(navNextIdx);
    setMode({ kind: 'input' });
  }

  if (mode.kind === 'summary') {
    return (
      <SessionSummary
        session={session}
        workoutName={trainingName(workout.name)}
        sets={liveSets}
        programExercises={effectiveProgramExercises}
        unit={unit}
        priorSets={priorSetsByExercise}
        onBack={() => setMode({ kind: 'input' })}
        onFinish={handleFinishSession}
        finishing={closing}
      />
    );
  }

  if (!currentPE || !currentTarget) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <EmptyState title={t('noExercises')} />
      </main>
    );
  }

  const lastPerf = lastPerformances[currentPE.exerciseId];
  const currentSets = setsByExercise.get(currentPE.exerciseId) ?? [];
  const currentWorkingCount = currentSets.filter((set) => !set.isWarmup).length;
  const currentReturnRecommendation = returnRecommendations[currentPE.id];
  const currentRecommendation = recommendationFor(currentTarget, Date.now());
  const isCardio = currentPE.exercise.category === 'CARDIO';
  const resting = mode.kind === 'rest';
  // The full rest screen covers the workout: nothing under it is reachable.
  const covered = resting && !restMinimized;
  const setInputCard = (
    <SetInput
      programExercise={currentTarget}
      existingSets={currentSets}
      lastPerformance={lastPerf}
      readiness={effectiveReadiness}
      deloadActive={deloadActive}
      unit={unit}
      returnRecommendation={currentReturnRecommendation}
      loadConstraints={loadConstraintsFor(currentTarget)}
      equipmentOptions={sessionEquipment.filter(
        (item) =>
          !droppedEquipmentIds.includes(item.id) &&
          item.exerciseLinks.some((link) => link.exerciseId === currentPE.exerciseId),
      )}
      onSubmit={handleValidate}
    />
  );
  const restNextPe =
    mode.kind === 'rest'
      ? mode.nextExerciseIdx != null
        ? (effectiveProgramExercises[mode.nextExerciseIdx] ?? null)
        : currentWorkingCount < currentTarget.targetSets
          ? currentTarget
          : null
      : null;
  // On the exercise on screen, the rest names the next set ("set 3 of 3");
  // when the rest moves on to another exercise, it names that exercise.
  const restNextSet =
    restNextPe && restNextPe.id === currentTarget.id && currentWorkingCount < currentTarget.targetSets
      ? { number: currentWorkingCount + 1, total: currentTarget.targetSets }
      : null;
  const restNextLabel =
    mode.kind === 'rest' && restNextPe && !restNextSet
      ? exerciseName(restNextPe.exercise.name)
      : null;
  const restRecommendation =
    mode.kind === 'rest' && restNextPe
      ? // A paused rest has not used its remaining time yet, so the recovery the
        // recommendation assumes runs until now plus what is left.
        recommendationFor(
          restNextPe,
          mode.pausedRemainingMs != null ? Date.now() + mode.pausedRemainingMs : mode.endsAt,
        )
      : null;
  const bare = (weight: number) =>
    formatWeight(weight, unit, { decimals: 2, group: false, locale, withUnit: false });
  const restContext = lastLogged
    ? restT(lastLogged.isWarmup ? 'loggedWarmup' : 'logged', {
        name: lastLogged.exerciseName,
        number: lastLogged.setNumber,
        load: `${bare(lastLogged.weight)} × ${lastLogged.reps}`,
      })
    : null;

  const completedIndexes = new Set(
    programExercises.flatMap((pe, index) => (completedProgramExerciseIds.has(pe.id) ? [index] : [])),
  );
  const upNext = navNextIdx != null ? (effectiveProgramExercises[navNextIdx] ?? null) : null;
  // The plate calculator of the exercise sheet breaks down today's load: the
  // last working set, else the next-set recommendation, else last time's top.
  const plateWeightKg =
    currentSets.filter((set) => !set.isWarmup).at(-1)?.weight ??
    currentRecommendation?.weight ??
    lastPerf?.maxWeight ??
    0;

  // The footer's main button: log the set on the lit row while the exercise
  // still has sets to do; once it is done, move on (or finish the workout).
  const loggable =
    !isCardio &&
    currentSet != null &&
    (currentSet.isWarmup || currentWorkingCount < currentTarget.targetSets);
  const cta = loggable
    ? {
        label: currentSet.isWarmup ? t('logWarmup') : t('logSet', { number: currentSet.number }),
        sub: `${
          currentSet.weight === 0 && currentPE.exercise.usesBodyweight
            ? cardT('bodyweight')
            : formatWeight(currentSet.weight, unit, { decimals: 2, group: false, locale })
        } × ${currentSet.reps}`,
        disabled: !hydrated || mode.kind !== 'input' || !currentSet.canConfirm,
        onClick: () => void tableRef.current?.confirm(),
      }
    : upNext
      ? {
          label: t('nextExercise'),
          sub: exerciseName(upNext.exercise.name),
          disabled: mode.kind !== 'input',
          onClick: goNext,
        }
      : {
          label: t('finishWorkout'),
          sub: null,
          disabled: false,
          onClick: () => setMode({ kind: 'summary' }),
        };

  return (
    <main className="flex flex-1 flex-col">
      <RestEndFlash count={restFlashCount} />
      {/* One header: minimize, workout, sync, coach and the workout menu, then
          the progress segments and the exercise tabs. Nothing else of the app
          chrome shows in a workout. */}
      <header
        inert={covered || undefined}
        className="sticky top-0 z-20 bg-background pt-[env(safe-area-inset-top)]"
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-1 px-2">
            <IconButton asChild aria-label={t('minimize')} title={t('minimize')}>
              <Link href="/">
                <CaretDownIcon />
              </Link>
            </IconButton>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-subtitle">{trainingName(workout.name)}</p>
              <p className="truncate text-[0.8125rem] font-medium tabular-nums text-muted-foreground">
                <ElapsedTime startedAt={session.startedAt} label={t('elapsed')} />
                {t('exerciseOf', { current: currentIdx + 1, total: programExercises.length })}
              </p>
            </div>
            <SyncStatus compact />
            {/* In-session coach access (issue #111): the chat with this
                session attached, so the advice is grounded in the live
                workout. Always available, never auto-triggered. */}
            <IconButton asChild aria-label={t('askCoach')} title={t('askCoach')}>
              <Link href={`/coach?sessionId=${session.id}`}>
                <ChatCircleTextIcon />
              </Link>
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton aria-label={t('workoutMenu')} title={t('workoutMenu')}>
                  <DotsThreeVerticalIcon />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={mode.kind !== 'input'}
                  onSelect={() => setExerciseMenuOpen(true)}
                >
                  {cardT('actions')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMode({ kind: 'summary' })}>
                  {t('finishWorkout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ProgressSegments
            total={programExercises.length}
            done={completedIndexes}
            current={currentIdx}
            label={t('progressLabel')}
            className="px-5 pt-1.5"
          />
          <SessionExerciseStrip
            exercises={programExercises}
            currentIndex={currentIdx}
            completedProgramExerciseIds={completedProgramExerciseIds}
            supersetLabels={supersetView.labels}
            disabled={mode.kind !== 'input'}
            onSelect={(index) => {
              selectExercise(index);
              setMode({ kind: 'input' });
            }}
            onOpen={(index) => {
              const pe = programExercises[index];
              if (!pe) return;
              const returnTo = sessionExercisePath(session.id, pe.id);
              router.push(exerciseDetailPath(pe.exerciseId, returnTo));
            }}
          />
        </div>
      </header>

      <div
        inert={covered || undefined}
        className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5"
      >
        <ExerciseCard
          programExercise={currentPE}
          lastPerformance={lastPerf}
          readiness={effectiveReadiness}
          deloadActive={deloadActive}
          unit={unit}
          gymName={session.gym?.name ?? null}
          loadConstraints={loadConstraintsFor(currentPE)}
          supersetLabel={supersetView.labels.get(currentPE.id) ?? null}
          onOpenMenu={() => setExerciseMenuOpen(true)}
          menuDisabled={mode.kind !== 'input'}
        />
        <SessionExerciseMenu
          open={exerciseMenuOpen}
          onOpenChange={setExerciseMenuOpen}
          programExercise={currentPE}
          programExercises={programExercises}
          catalog={catalog}
          loggedSetCount={currentSets.length}
          plates={{
            weightKg: plateWeightKg,
            unit,
            loadConstraints: loadConstraintsFor(currentTarget),
          }}
          onSwapForSession={(exercise) => handleSwapForSession(currentPE.id, exercise)}
          onChanged={(options) => {
            setExerciseMenuOpen(false);
            if (options?.selectProgramExerciseId) {
              setPendingExerciseSelection({
                selectProgramExerciseId: options.selectProgramExerciseId,
                removedProgramExerciseId: options.removedProgramExerciseId,
              });
            }
            router.refresh();
          }}
        />
        <ReturnToTrainingNotice
          recommendation={currentReturnRecommendation}
          unit={unit}
          usesBodyweight={currentTarget.exercise.usesBodyweight}
        />

        {isCardio ? (
          <SetsList
            programExercise={currentTarget}
            sets={currentSets}
            isInputActive={mode.kind === 'input'}
            onDeleteSet={handleDeleteSet}
            priorSets={lastPerf?.sets}
          />
        ) : (
          <EditableSetsTable
            programExercise={currentTarget}
            sets={currentSets}
            lastPerformance={lastPerf}
            readiness={effectiveReadiness}
            deloadActive={deloadActive}
            unit={unit}
            recommendation={currentRecommendation}
            loadConstraints={loadConstraintsFor(currentTarget)}
            priorSets={lastPerf?.sets}
            gymId={session.gym?.id ?? null}
            equipmentOptions={sessionEquipment.filter(
              (item) =>
                !droppedEquipmentIds.includes(item.id) &&
                item.exerciseLinks.some((link) => link.exerciseId === currentPE.exerciseId),
            )}
            disabled={!hydrated || mode.kind !== 'input'}
            onEquipmentWeightsUpdated={handleEquipmentWeightsUpdated}
            onSubmit={handleValidate}
            onDeleteSet={handleDeleteSet}
            onUpdateSet={handleUpdateSet}
            actionRef={tableRef}
            onCurrentSetChange={setCurrentSet}
          />
        )}

        {/* One logger: for strength the rows above are the logger (prefilled
            with the suggestion, set type, RPE and note in its options). The
            full form stays one tap away for text shortcuts and AI parsing;
            cardio keeps it as its only input. */}
        {hydrated && mode.kind === 'input' ? (
          isCardio ? (
            setInputCard
          ) : (
            <details className="group border-t border-border">
              <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 text-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {t('detailedEntry')}
                <CaretDownIcon className="size-4 text-muted-foreground transition-transform duration-[120ms] ease-out-quart group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="pb-2">{setInputCard}</div>
            </details>
          )
        ) : null}

        {upNext && mode.kind === 'input' && (
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.8125rem] font-medium text-muted-foreground">
                {t('upNext')}
              </span>
              <span className="truncate text-body font-semibold">
                {supersetView.labels.get(upNext.id)
                  ? `${supersetView.labels.get(upNext.id)} · `
                  : ''}
                {exerciseName(upNext.exercise.name)}
              </span>
            </div>
            {upNext.exercise.category !== 'CARDIO' && (
              <Num stretch={112} className="shrink-0 text-caption">
                {cardT('setsReps', {
                  sets: upNext.targetSets,
                  reps:
                    upNext.targetRepsMin === upNext.targetRepsMax
                      ? `${upNext.targetRepsMin}`
                      : `${upNext.targetRepsMin}‑${upNext.targetRepsMax}`,
                })}
              </Num>
            )}
          </div>
        )}
      </div>

      {/* Fixed footer, docked: previous, the main action, next; 64px targets
          above the safe area. Finishing the workout is in the header menu. */}
      <footer
        inert={covered || undefined}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <IconButton
            size="session"
            tone="outline"
            onClick={goPrev}
            disabled={currentIdx === 0 || mode.kind !== 'input'}
            aria-label={t('previous')}
            title={t('previous')}
          >
            <CaretLeftIcon />
          </IconButton>
          <Button
            size="session"
            onClick={cta.onClick}
            disabled={cta.disabled}
            className="min-w-0 flex-1 flex-col gap-px px-3"
          >
            <span className="max-w-full truncate text-subtitle">{cta.label}</span>
            {cta.sub && (
              <span className="max-w-full truncate text-[0.8125rem] font-semibold tabular-nums text-brand-strong">
                {cta.sub}
              </span>
            )}
          </Button>
          <IconButton
            size="session"
            tone="outline"
            onClick={goNext}
            disabled={navNextIdx == null || mode.kind !== 'input'}
            aria-label={t('next')}
            title={t('next')}
          >
            <CaretRightIcon />
          </IconButton>
        </div>
      </footer>

      {mode.kind === 'rest' && (
        <RestTimer
          endsAt={mode.endsAt}
          pausedRemainingMs={mode.pausedRemainingMs}
          totalSec={mode.totalSec}
          nextLabel={restNextLabel}
          nextSet={restNextSet}
          context={restContext}
          recommendation={restRecommendation}
          unit={unit}
          minimized={restMinimized}
          onMinimize={() => setRestMinimized(true)}
          onExpand={() => setRestMinimized(false)}
          onEnd={handleRestEnd}
          onSkip={handleSkipRest}
          onPause={handlePauseRest}
          onResume={handleResumeRest}
          onAdjust={handleAdjustRest}
        />
      )}
    </main>
  );
}

// Time since the workout started, ticking each second. Rendered after mount
// only, so the server and the first client render agree.
function ElapsedTime({ startedAt, label }: { startedAt: Date | string; label: string }) {
  const start = new Date(startedAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now == null || !Number.isFinite(start)) return null;
  return (
    <>
      <span className="sr-only">{label}: </span>
      {formatClock((now - start) / 1000)}
      <span aria-hidden> · </span>
    </>
  );
}
