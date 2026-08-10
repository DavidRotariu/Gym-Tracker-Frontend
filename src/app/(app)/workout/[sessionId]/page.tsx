"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { NumericKeypadProvider } from "@/components/workout/NumericKeypad";
import { RestTimer } from "@/components/workout/RestTimer";
import { SupersetGroup } from "@/components/workout/SupersetGroup";
import { WorkoutSummary } from "@/components/workout/WorkoutSummary";
import { useExercises } from "@/hooks/use-exercises";
import { useMuscles } from "@/hooks/use-muscles";
import { useSplit } from "@/hooks/use-splits";
import {
  useAddExercise,
  useDeleteSet,
  useLogSet,
  usePatchSets,
  useRemoveExercise,
  useRemoveSuperset,
  useSwapExercise,
} from "@/hooks/use-workout-session";
import type { SetPatch } from "@/hooks/use-workout-session";
import { usePatchWorkout, useWorkout } from "@/hooks/use-workouts";
import { getLastSet } from "@/lib/api/exercises";
import { formatElapsed, shortMuscleName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Set, WorkoutExercise, WorkoutSession } from "@/types";
import { Reorder, useDragControls } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/** Stable id for a group (a superset counts as one draggable unit). */
function groupKey(group: WorkoutExercise[]): string {
  const gid = group[0].superset_group_id;
  return group.length > 1 && gid !== null ? `ss-${gid}` : group[0].id;
}

// ponytail: there's no reorder endpoint on the backend (only add/remove/swap),
// so custom ordering is mirrored client-side the same way favourites are —
// it survives reloads on this device but isn't synced anywhere else.
const ORDER_KEY_PREFIX = "overload_exercise_order_";

function readOrder(sessionId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ORDER_KEY_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveOrder(sessionId: string, order: string[]) {
  localStorage.setItem(ORDER_KEY_PREFIX + sessionId, JSON.stringify(order));
}

export default function WorkoutSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const { data: session, isLoading } = useWorkout(sessionId);
  const { data: split } = useSplit(session?.split_id ?? null);
  const { data: exercises } = useExercises();
  const { data: muscles } = useMuscles();

  const patchWorkout = usePatchWorkout(sessionId);
  const addExercise = useAddExercise(sessionId);
  const removeExercise = useRemoveExercise(sessionId);
  const swapExercise = useSwapExercise(sessionId);
  const removeSuperset = useRemoveSuperset(sessionId);
  const logSet = useLogSet(sessionId);
  const patchSets = usePatchSets(sessionId);
  const deleteSet = useDeleteSet(sessionId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<WorkoutExercise | null>(null);
  const [restSignal, setRestSignal] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | undefined>(undefined);
  const [summary, setSummary] = useState<WorkoutSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const exerciseNames = useMemo(
    () => new Map(exercises?.map((e) => [e.id, e.name])),
    [exercises],
  );
  const exerciseMuscle = useMemo(() => {
    const muscleNames = new Map(muscles?.map((m) => [m.id, shortMuscleName(m.name)]));
    return new Map(
      exercises?.map((e) => [e.id, muscleNames.get(e.muscle_id) ?? ""]),
    );
  }, [exercises, muscles]);
  const exerciseMedia = useMemo(
    () => new Map(exercises?.map((e) => [e.id, e.video_url ?? e.thumbnail_url])),
    [exercises],
  );
  const exerciseMuscleId = useMemo(
    () => new Map(exercises?.map((e) => [e.id, e.muscle_id])),
    [exercises],
  );

  /** Consecutive exercises sharing a superset_group_id render as one group. */
  const groups = useMemo(() => {
    if (!session) return [];
    const ordered = [...session.exercises].sort(
      (a, b) => a.order_index - b.order_index,
    );
    const seen = new Set<number>();
    const result: WorkoutExercise[][] = [];
    for (const we of ordered) {
      if (we.superset_group_id !== null) {
        if (seen.has(we.superset_group_id)) continue;
        seen.add(we.superset_group_id);
        result.push(
          ordered.filter((e) => e.superset_group_id === we.superset_group_id),
        );
      } else {
        result.push([we]);
      }
    }
    return result;
  }, [session]);

  const [order, setOrder] = useState<string[]>([]);

  // Re-derive display order whenever the group set changes: keep the saved
  // drag order for groups that still exist, append anything new at the end.
  useEffect(() => {
    const keys = groups.map(groupKey);
    const saved = readOrder(sessionId);
    if (!saved) {
      setOrder(keys);
      return;
    }
    const known = new Set(keys);
    const kept = saved.filter((k) => known.has(k));
    const added = keys.filter((k) => !saved.includes(k));
    setOrder([...kept, ...added]);
  }, [groups, sessionId]);

  const orderedGroups = useMemo(() => {
    const byKey = new Map(groups.map((g) => [groupKey(g), g]));
    return order.map((k) => byKey.get(k)).filter((g): g is WorkoutExercise[] => !!g);
  }, [groups, order]);

  function handleReorder(next: string[]) {
    setOrder(next);
    saveOrder(sessionId, next);
  }

  const flatExerciseOrder = useMemo(() => orderedGroups.flat(), [orderedGroups]);
  const listRef = useRef<HTMLDivElement>(null);

  // Exactly one exercise is "in focus" at a time — starts on the first,
  // follows scroll position, and jumps ahead when a set completion finishes
  // an exercise (see advanceToNextExercise). Every other card dims (see
  // ExerciseCard's `dimmed` prop / globals.css .exercise-card).
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);

  // Default to the first exercise once the list loads; also recovers if the
  // currently-focused one gets removed or swapped away mid-session.
  useEffect(() => {
    if (flatExerciseOrder.length === 0) {
      setFocusedExerciseId(null);
      return;
    }
    setFocusedExerciseId((current) =>
      current && flatExerciseOrder.some((e) => e.id === current)
        ? current
        : flatExerciseOrder[0].id,
    );
  }, [flatExerciseOrder]);

  // Scroll-spy: whichever card is crossing the vertical center of the
  // viewport becomes the focused one, so scrolling away hands focus off
  // even with no tap involved. A thin center band (not the whole viewport)
  // keeps this to one card at a time for any card taller than ~10% of the
  // screen, which every exercise card is.
  useEffect(() => {
    if (flatExerciseOrder.length === 0) return;
    const cards =
      listRef.current?.querySelectorAll<HTMLElement>(".exercise-card") ?? [];
    if (cards.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (hit) setFocusedExerciseId(hit.target.id.replace("we-", ""));
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    cards.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [flatExerciseOrder]);

  /** Tapping straight into a card claims focus immediately, rather than
   *  waiting on the scroll-spy (which only reacts to actual scrolling). */
  function handleExerciseAreaFocus(e: React.FocusEvent) {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".exercise-card");
    if (card) setFocusedExerciseId(card.id.replace("we-", ""));
  }

  /**
   * Once an exercise's last set is checked off, jump straight to the next
   * one instead of leaving the lifter to scroll and tap back in. A short
   * delay lets the completion animation land first.
   */
  function advanceToNextExercise(currentWeId: string) {
    const idx = flatExerciseOrder.findIndex((e) => e.id === currentWeId);
    const next = idx === -1 ? undefined : flatExerciseOrder[idx + 1];
    if (!next) return;
    setFocusedExerciseId(next.id);
    setTimeout(() => {
      const el = document.getElementById(`we-${next.id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // A freshly-added exercise has no sets yet — no weight input to land
      // in, so focus its "Log first set" button instead. Either way
      // something inside the card ends up focused.
      const target =
        el.querySelector<HTMLElement>('button[aria-label$="weight"]') ??
        el.querySelector<HTMLElement>("[data-add-set]");
      target?.focus();
    }, 350);
  }

  async function handleAddExercise(exerciseId: string) {
    if (swapTarget) {
      await swapExercise.mutateAsync({
        workoutExerciseId: swapTarget.id,
        exerciseId,
      });
      setSwapTarget(null);
      return;
    }
    await addExercise.mutateAsync({
      exerciseId,
      orderIndex: session?.exercises.length ?? 0,
    });
  }

  /**
   * New sets copy the previous set in this exercise so consecutive logging is
   * two taps; the first set of an exercise falls back to the last time this
   * exercise was trained.
   */
  async function handleAddSet(we: WorkoutExercise) {
    const previous = [...we.sets].sort((a, b) => b.set_number - a.set_number)[0];
    const seed = previous
      ? {
          weight: previous.actual_weight,
          reps: previous.actual_reps,
          rir: previous.actual_rir,
          type: previous.set_type,
        }
      : await getLastSet(we.exercise_id)
          .catch(() => null)
          .then((last) => ({
            weight: last?.actual_weight ?? null,
            reps: last?.actual_reps ?? null,
            rir: last?.actual_rir ?? null,
            type: "standard" as const,
          }));

    await logSet.mutateAsync({
      workoutExerciseId: we.id,
      input: {
        set_number: we.sets.length + 1,
        set_type: seed.type,
        target_weight: null,
        target_reps: null,
        target_rir: null,
        actual_weight: seed.weight,
        actual_reps: seed.reps,
        actual_rir: seed.rir,
        completed: false,
      },
    });
  }

  /**
   * Filling in a set's weight or reps carries that value forward to any
   * later set in the same exercise whose *same field* is still untouched —
   * logging a straight-sets exercise becomes "type once, tap complete" for
   * every set after the first instead of retyping the same numbers. Weight
   * and reps propagate independently, since they're typed one after the
   * other (weight, then tab to reps): a set that already got its weight
   * from this carry-forward still picks up reps a moment later. Any field a
   * set already has — typed by hand or carried forward earlier — is left
   * alone, so correcting set 1 after set 3 diverges doesn't stomp it.
   *
   * The edit itself and every forward-filled set go out as one batch (see
   * usePatchSets) — one cache write, one re-render, so all of them change
   * on screen in the same instant instead of a visible cascade.
   */
  function handleChangeSet(we: WorkoutExercise, setId: string, patch: Partial<Set>) {
    const updates: SetPatch[] = [{ id: setId, patch }];

    const current = we.sets.find((s) => s.id === setId);
    if (current) {
      if (patch.actual_weight !== undefined && patch.actual_weight !== null) {
        for (const s of we.sets) {
          if (s.set_number > current.set_number && s.actual_weight === null) {
            updates.push({ id: s.id, patch: { actual_weight: patch.actual_weight } });
          }
        }
      }
      if (patch.actual_reps !== undefined && patch.actual_reps !== null) {
        for (const s of we.sets) {
          if (s.set_number > current.set_number && s.actual_reps === null) {
            updates.push({ id: s.id, patch: { actual_reps: patch.actual_reps } });
          }
        }
      }
    }

    patchSets.mutate(updates);

    if (patch.completed === true) {
      // Each exercise carries its own configured rest time, so the timer
      // that pops up after this set matches this exercise, not whatever was
      // last used.
      setRestSeconds(exercises?.find((e) => e.id === we.exercise_id)?.rest_time);
      setRestSignal((n) => n + 1);

      // This set was the last one still open — the exercise is now fully
      // logged, so move on. `we` is the pre-mutation snapshot, so the set
      // being completed here still reads as incomplete; every *other* set
      // already being done is what "last set" means.
      const wasLastOpenSet = we.sets.every((s) => s.id === setId || s.completed);
      if (wasLastOpenSet) advanceToNextExercise(we.id);
    }
  }

  async function finish() {
    if (!session) return;
    const updated = await patchWorkout.mutateAsync({
      completed_at: new Date().toISOString(),
    });
    setSummary({
      ...session,
      completed_at: updated?.completed_at ?? new Date().toISOString(),
    });
  }

  if (isLoading || !session) {
    return (
      <div className="flex flex-col gap-3 pt-[calc(env(safe-area-inset-top)+64px)]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-card bg-fill"
          />
        ))}
      </div>
    );
  }

  const title = split?.name ?? "Ad-hoc workout";
  const hasExercises = session.exercises.length > 0;

  return (
    <NumericKeypadProvider>
      {/* Session bar ---------------------------------------------------- */}
      <div className="fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-[480px] border-b border-separator bg-chrome pt-[env(safe-area-inset-top)] [backdrop-filter:blur(20px)]">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => router.push("/home")}
            aria-label="Back to home"
            className="-ml-2 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-label-secondary active:bg-fill"
          >
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
              <path
                d="M9.5 2 2.5 10l7 8"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold text-label">{title}</p>
            <p className="tabular text-caption text-accent-ink">
              {formatElapsed(session.started_at, now)}
            </p>
          </div>

          <Button size="sm" onClick={finish} disabled={patchWorkout.isPending}>
            Finish
          </Button>
        </div>
      </div>

      <div className="pt-[calc(env(safe-area-inset-top)+3.5rem+1rem)]">
        {hasExercises && (
          <h2 className="mb-3 px-1 text-body font-semibold text-label">
            Exercises
          </h2>
        )}

        {/* Exercises ---------------------------------------------------- */}
        {!hasExercises ? (
          <Card flush>
            <EmptyState
              title="Nothing logged yet"
              description="Add your first exercise to start this session."
              action={
                <Button onClick={() => setPickerOpen(true)}>
                  Add exercise
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <Reorder.Group
              as="div"
              ref={listRef}
              axis="y"
              values={order}
              onReorder={handleReorder}
              onFocus={handleExerciseAreaFocus}
              className="workout-exercises flex flex-col gap-3"
            >
              {orderedGroups.map((group) => {
                const groupId = group[0].superset_group_id;
                const key = groupKey(group);

                return (
                  <DraggableGroup key={key} groupKey={key}>
                    {(startDrag) => {
                      const cards = group.map((we) => (
                        <ExerciseCard
                          key={we.id}
                          workoutExercise={we}
                          name={exerciseNames.get(we.exercise_id) ?? "Exercise"}
                          muscle={exerciseMuscle.get(we.exercise_id)}
                          mediaUrl={exerciseMedia.get(we.exercise_id)}
                          onChangeSet={(setId, patch) => handleChangeSet(we, setId, patch)}
                          onDeleteSet={(setId) => deleteSet.mutate(setId)}
                          onAddSet={() => handleAddSet(we)}
                          onRemove={() => removeExercise.mutate(we.id)}
                          onSwap={() => setSwapTarget(we)}
                          onDragHandlePointerDown={startDrag}
                          addPending={logSet.isPending}
                          dimmed={
                            focusedExerciseId !== null && focusedExerciseId !== we.id
                          }
                        />
                      ));

                      return group.length > 1 && groupId !== null ? (
                        <SupersetGroup onUngroup={() => removeSuperset.mutate(groupId)}>
                          {cards}
                        </SupersetGroup>
                      ) : (
                        cards
                      );
                    }}
                  </DraggableGroup>
                );
              })}
            </Reorder.Group>

            <button
              onClick={() => setPickerOpen(true)}
              className={cn(
                "h-14 cursor-pointer rounded-card border border-dashed border-separator",
                "text-body font-semibold text-label-secondary",
                "active:border-accent-ink active:text-accent-ink",
              )}
            >
              Add exercise
            </button>
          </div>
        )}
      </div>

      {/* Rest timer, pinned above the safe area. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="pointer-events-auto">
          <RestTimer startSignal={restSignal} restSeconds={restSeconds} />
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen || swapTarget !== null}
        onClose={() => {
          setPickerOpen(false);
          setSwapTarget(null);
        }}
        onSelect={handleAddExercise}
        title={swapTarget ? "Swap exercise" : "Add exercise"}
        allowedMuscleIds={
          swapTarget
            ? [exerciseMuscleId.get(swapTarget.exercise_id)].filter(
                (id): id is string => id !== undefined,
              )
            : split?.muscles.map((m) => m.muscle_id)
        }
      />

      {summary && (
        <WorkoutSummary
          session={summary}
          title={title}
          exerciseNames={exerciseNames}
          onDone={() => router.replace(`/history/${sessionId}`)}
        />
      )}
    </NumericKeypadProvider>
  );
}

/**
 * A group (single exercise or superset) draggable by a handle living inside
 * each card's own action pill (alongside swap/remove) rather than a
 * dedicated grip column — `startDrag` is handed down so any card in the
 * group can kick off dragging the whole group.
 */
function DraggableGroup({
  groupKey,
  children,
}: {
  groupKey: string;
  children: (startDrag: (e: React.PointerEvent) => void) => React.ReactNode;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item value={groupKey} dragListener={false} dragControls={controls}>
      {children((e) => controls.start(e))}
    </Reorder.Item>
  );
}
