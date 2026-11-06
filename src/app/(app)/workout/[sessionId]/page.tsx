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
import { markExerciseTrained } from "@/hooks/use-favorites";
import { useMuscles } from "@/hooks/use-muscles";
import { useSplit } from "@/hooks/use-splits";
import {
  exerciseKeyAlias,
  useAddExercise,
  useDeleteSet,
  useLogSet,
  usePatchSets,
  useRemoveExercise,
  useRemoveSuperset,
  useSwapExercise,
} from "@/hooks/use-workout-session";
import type { SetPatch } from "@/hooks/use-workout-session";
import { useDeleteWorkout, usePatchWorkout, useWorkout } from "@/hooks/use-workouts";
import { getExerciseHistory } from "@/lib/api/exercises";
import { MAX_WORKOUT_MS, formatElapsed, shortMuscleName, workoutEndTime } from "@/lib/format";
import { isProgrammaticScroll, scrollIntoViewQuietly } from "@/lib/scroll";
import { cn } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api/client";
import type { Set, WorkoutExercise, WorkoutSession } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { Reorder, useDragControls } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/** Placeholder rows (see useLogSet) the server doesn't know yet — PATCHing one 404s and rolls the whole batch back. */
function isSaved(s: Set): boolean {
  return !s.id.startsWith("optimistic-");
}

/** Stable id for a group (a superset counts as one draggable unit). */
function groupKey(group: WorkoutExercise[]): string {
  const gid = group[0].superset_group_id;
  return group.length > 1 && gid !== null ? `ss-${gid}` : keyOf(group[0]);
}

/** React key / drag id that survives the optimistic → real id swap (see exerciseKeyAlias). */
function keyOf(we: WorkoutExercise): string {
  return exerciseKeyAlias.get(we.id) ?? we.id;
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

/** A group's id as the server knows it — survives a reload, unlike its render key. */
function persistId(group: WorkoutExercise[]): string {
  const gid = group[0].superset_group_id;
  return group.length > 1 && gid !== null ? `ss-${gid}` : group[0].id;
}

function toPersistIds(groups: WorkoutExercise[][], keys: string[]): string[] {
  const pidByKey = new Map(groups.map((g) => [groupKey(g), persistId(g)]));
  return keys.map((k) => pidByKey.get(k) ?? k);
}

export default function WorkoutSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;
  const qc = useQueryClient();

  const { data: session, isLoading, error: loadError, refetch, isFetching } = useWorkout(sessionId);
  const { data: split } = useSplit(session?.split_id ?? null);
  const { data: exercises } = useExercises();
  const { data: muscles } = useMuscles();

  const patchWorkout = usePatchWorkout(sessionId);
  const deleteWorkout = useDeleteWorkout();
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
  // Failed set/exercise actions used to vanish silently (the optimistic row
  // just rolled back), which read as "the button doesn't work".
  /** Highest set_number handed out per exercise — see handleAddSet. */
  const issuedSetNumber = useRef(new Map<string, number>());
  const [actionError, setActionError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showError(err: unknown) {
    setActionError(err instanceof Error && err.message ? err.message : "Something went wrong.");
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setActionError(null), 4000);
  }
  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // A finished workout isn't editable here — if one is opened anyway (stale
  // "Resume" button, old link), send it to its read-only history page. The
  // finish screen itself (`summary`) stays up until dismissed.
  // Past 3 hours it's no longer a live workout: close it out at the last
  // logged set (see workoutEndTime). Once saved, the redirect below sends it
  // to its history page.
  const autoEnded = useRef(false);
  useEffect(() => {
    if (!session || session.completed_at || summary || autoEnded.current) return;
    if (now - new Date(session.started_at).getTime() <= MAX_WORKOUT_MS) return;
    autoEnded.current = true;
    patchWorkout.mutate({ completed_at: workoutEndTime(session, Date.now()) });
  }, [session, summary, now, patchWorkout]);

  const alreadyCompleted = !!session?.completed_at && !summary;
  useEffect(() => {
    if (alreadyCompleted) router.replace(`/history/${sessionId}`);
  }, [alreadyCompleted, router, sessionId]);

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
  const exerciseType = useMemo(
    () => new Map(exercises?.map((e) => [e.id, e.exercise_type])),
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
  //
  // What's *stored* is each group's server id (persistId), not its render
  // key: an exercise added this session keeps its optimistic id as its key
  // for the page's lifetime (exerciseKeyAlias, memory only), so saving keys
  // meant the order of every in-session exercise was lost on reload. The
  // re-save here also swaps a just-confirmed placeholder's id for its real one.
  useEffect(() => {
    // Nothing loaded yet — re-saving now would wipe the stored order.
    if (groups.length === 0) {
      setOrder([]);
      return;
    }
    const keys = groups.map(groupKey);
    const keyByPid = new Map(groups.map((g) => [persistId(g), groupKey(g)]));
    const saved = readOrder(sessionId);
    if (!saved) {
      setOrder(keys);
      return;
    }
    const kept = saved.map((p) => keyByPid.get(p)).filter((k): k is string => !!k);
    const keptSet = new Set(kept);
    const next = [...kept, ...keys.filter((k) => !keptSet.has(k))];
    setOrder(next);
    saveOrder(sessionId, toPersistIds(groups, next));
  }, [groups, sessionId]);

  const orderedGroups = useMemo(() => {
    const byKey = new Map(groups.map((g) => [groupKey(g), g]));
    return order.map((k) => byKey.get(k)).filter((g): g is WorkoutExercise[] => !!g);
  }, [groups, order]);

  function handleReorder(next: string[]) {
    setOrder(next);
    saveOrder(sessionId, toPersistIds(groups, next));
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
    setFocusedExerciseId((current) => {
      if (current && flatExerciseOrder.some((e) => e.id === current)) return current;
      // The focused card was optimistic and just got its real id — follow it
      // rather than snapping back to the first exercise.
      const renamed = flatExerciseOrder.find((e) => exerciseKeyAlias.get(e.id) === current);
      return renamed ? renamed.id : flatExerciseOrder[0].id;
    });
  }, [flatExerciseOrder]);

  // A just-added exercise: once its card is in the DOM, scroll to it and make
  // it the focused card. Runs once for the optimistic card; the later swap to
  // the real id only re-points focus (the card is already on screen).
  const justAdded = useRef<{ orderIndex: number; scrolled: boolean } | null>(null);
  useEffect(() => {
    const target = justAdded.current;
    if (!target) return;
    const we = flatExerciseOrder.find((e) => e.order_index === target.orderIndex);
    if (!we) return;
    setFocusedExerciseId(we.id);
    if (!target.scrolled) {
      target.scrolled = true;
      // The picker is still sliding away and holds the body scroll lock
      // (overflow:hidden swallows scrollIntoView) — wait for it to release.
      // Not cleaned up on re-render: the optimistic → real swap re-runs this
      // effect and must not cancel the pending scroll.
      let tries = 0;
      const go = () => {
        if (document.body.style.overflow === "hidden" && tries++ < 20) {
          setTimeout(go, 100);
          return;
        }
        // Looked up by order_index, not id — the id changes on the swap.
        const card = document.querySelector(`.exercise-card[data-order-index="${target.orderIndex}"]`);
        if (card) scrollIntoViewQuietly(card, "center");
      };
      setTimeout(go, 150);
    }
    if (!we.id.startsWith("optimistic-")) justAdded.current = null;
  }, [flatExerciseOrder]);

  // Scroll-spy: the card nearest the vertical center of the *visible* area
  // (below the fixed session bar) becomes the focused one. Computed from card
  // rects on scroll rather than an IntersectionObserver band: the band could
  // straddle the gap between two cards and pick the DOM-first one instead of
  // the one actually under the center, could never select the last card when
  // scrolled to the bottom, and only reported crossings, so focus could be
  // left on a card that had scrolled away.
  useEffect(() => {
    if (flatExerciseOrder.length === 0) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      // An app-started smooth scroll passes over other cards on its way —
      // those frames aren't the lifter choosing a card.
      if (isProgrammaticScroll()) return;
      // While a set is being typed into, its card keeps focus: scrolling to
      // glance at another exercise mustn't dim the one being edited.
      if ("keypadOpen" in document.body.dataset) return;
      const cards = [...(listRef.current?.querySelectorAll<HTMLElement>(".exercise-card") ?? [])];
      if (cards.length === 0) return;
      // Measured, not a hard-coded 56px — the bar also includes the
      // safe-area inset (~59px under the Dynamic Island).
      const top =
        document.querySelector("[data-session-bar]")?.getBoundingClientRect().bottom ?? 56;
      const center = (top + window.innerHeight) / 2;
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        const dist = center < r.top ? r.top - center : center > r.bottom ? center - r.bottom : 0;
        if (dist < bestDist) {
          best = el;
          bestDist = dist;
        }
      }
      // Scrolled all the way down, a short last card can never reach the
      // center — it still counts once its top has made it above the center.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const last = cards[cards.length - 1];
      if (atBottom && last.getBoundingClientRect().top < center) best = last;
      // Mirror image at the top: scrolled all the way up, the first card is
      // the one in front of you even though it sits above the center.
      if (window.scrollY <= 2) best = cards[0];
      if (best) setFocusedExerciseId(best.id.replace("we-", ""));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
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
      scrollIntoViewQuietly(el, "center");
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
    // Both are optimistic (see the hooks): fire and return so the picker
    // closes on the tap instead of waiting on the network. A failure rolls
    // the cache back and surfaces through the error toast.
    if (swapTarget) {
      const target = swapTarget;
      setSwapTarget(null);
      swapExercise.mutateAsync({ workoutExerciseId: target.id, exerciseId }).catch(showError);
      return;
    }
    // Next free slot, not `length` — removing an exercise leaves a gap, and
    // length would then collide with an existing order_index forever.
    const orderIndex =
      Math.max(-1, ...(session?.exercises.map((e) => e.order_index) ?? [])) + 1;
    justAdded.current = { orderIndex, scrolled: false };
    addExercise.mutateAsync({ exerciseId, orderIndex }).catch(showError);
  }

  /**
   * New sets copy the previous set in this exercise so consecutive logging is
   * two taps; the first set of an exercise falls back to the last time this
   * exercise was trained.
   *
   * That fallback is a network fetch (exercise history) — awaiting it
   * *before* calling logSet used to hold the whole "Log first set" tap
   * hostage on a round trip before anything appeared. logSet itself is
   * optimistic (see useLogSet), so instead this fires the set immediately
   * with whatever seed is already known synchronously, and — only for a
   * first set, only once the history fetch lands — patches the weight/reps
   * in a moment later instead of blocking on them up front.
   *
   * The fallback must match by set_number (set 1 seeds from last workout's
   * set 1, not just whichever set was logged last) — an earlier version used
   * a "last set" endpoint that ignored set_number entirely, so e.g. a
   * 2-set exercise would seed set 1 from last workout's set 2.
   */
  /**
   * Each tap adds exactly one set, right away — even several taps in a row
   * on a slow connection (the writes queue up in order, see sessionWrite).
   * This used to block further taps until the server answered, so three
   * quick taps gave one set. Reads the live cache rather than the render's
   * `we`, and reserves set numbers, so taps landing before the previous
   * optimistic row has rendered never reuse a set_number.
   */
  function handleAddSet(weId: string) {
    const we = qc
      .getQueryData<WorkoutSession>(["workouts", sessionId])
      ?.exercises.find((e) => e.id === weId);
    if (!we) return;
    const previous = [...we.sets].sort((a, b) => b.set_number - a.set_number)[0];
    // Next free number, not `length + 1` — deleting a middle set leaves a gap
    // and length + 1 would then duplicate an existing set_number.
    const setNumber =
      Math.max(0, issuedSetNumber.current.get(weId) ?? 0, ...we.sets.map((s) => s.set_number)) + 1;
    issuedSetNumber.current.set(weId, setNumber);

    // mutateAsync, not mutate(…, callbacks): React Query only runs per-call
    // callbacks for the *latest* call on a hook, so with several taps in
    // flight an earlier set's failure (or first-set seed) was silently lost.
    logSet
      .mutateAsync({
        workoutExerciseId: we.id,
        input: {
          set_number: setNumber,
          set_type: previous?.set_type ?? "standard",
          target_weight: null,
          target_reps: null,
          target_rir: null,
          actual_weight: previous?.actual_weight ?? null,
          actual_reps: previous?.actual_reps ?? null,
          actual_rir: previous?.actual_rir ?? null,
          completed: false,
        },
      })
      .then(
        (created) => {
          if (!previous) void seedFirstSet(we, created.id, setNumber);
        },
        (err) => {
          // Re-derive from the cache next time, now that this row is gone.
          issuedSetNumber.current.delete(weId);
          showError(err);
        },
      );
  }

  async function seedFirstSet(we: WorkoutExercise, createdId: string, setNumber: number) {
    const history = await getExerciseHistory(we.exercise_id, { limit: 2 }).catch(() => null);
    const last = history?.find((h) => h.workout_session_id !== sessionId)?.sets.find((s) => s.set_number === setNumber);
    if (!last) return;
    // The history fetch can land seconds later on a slow connection — only
    // fill a set that's still untouched, never over what the lifter typed
    // (or ticked off) in the meantime.
    const now = qc
      .getQueryData<WorkoutSession>(["workouts", sessionId])
      ?.exercises.flatMap((e) => e.sets)
      .find((s) => s.id === createdId);
    if (!now || now.completed || now.actual_weight !== null || now.actual_reps !== null) return;
    patchSets.mutate([
      {
        id: createdId,
        patch: {
          actual_weight: last.actual_weight,
          actual_reps: last.actual_reps,
          actual_rir: last.actual_rir,
        },
      },
    ]);
  }

  /**
   * Filling in a set's weight or reps carries that value forward to any
   * later, not-yet-completed set in the same exercise whose *same field* is
   * still untouched (a completed set is logged history — never rewritten) —
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
          if (isSaved(s) && !s.completed && s.set_number > current.set_number && s.actual_weight === null) {
            updates.push({ id: s.id, patch: { actual_weight: patch.actual_weight } });
          }
        }
      }
      if (patch.actual_reps !== undefined && patch.actual_reps !== null) {
        for (const s of we.sets) {
          if (isSaved(s) && !s.completed && s.set_number > current.set_number && s.actual_reps === null) {
            updates.push({ id: s.id, patch: { actual_reps: patch.actual_reps } });
          }
        }
      }
    }

    patchSets.mutateAsync(updates).catch(showError);

    if (patch.completed === true) {
      // Each exercise carries its own configured rest time, so the timer
      // that pops up after this set matches this exercise, not whatever was
      // last used.
      // 0 means "no rest timer" — starting one would chime on the spot.
      const rest = exercises?.find((e) => e.id === we.exercise_id)?.rest_time;
      if (rest !== 0) {
        setRestSeconds(rest);
        setRestSignal((n) => n + 1);
      }

      // First real set logged for this exercise — favourite it so the
      // picker's "liked" sort (see ExercisePicker) surfaces it without the
      // lifter having to hand-favourite everything they already do.
      markExerciseTrained(we.exercise_id);

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
    // `now` is the page's 1s clock — close enough, and keeps the React
    // Compiler from flagging Date.now() in this handler as impure.
    const endedAt = workoutEndTime(session, now);
    try {
      // patchWorkout shares the session's write queue, so this resolves only
      // after every set edit made before Finish has reached the server.
      const updated = await patchWorkout.mutateAsync({ completed_at: endedAt });
      // Summarize what the cache holds *now* — any queued write that failed
      // has rolled itself back by this point, so this matches the server.
      const latest = qc.getQueryData<WorkoutSession>(["workouts", sessionId]) ?? session;
      setSummary({ ...latest, completed_at: updated?.completed_at ?? endedAt });
      localStorage.removeItem(ORDER_KEY_PREFIX + sessionId); // local-only state, done with
    } catch (err) {
      showError(err);
    }
  }

  /** Removing an exercise deletes its logged sets with it — ask first when there are any. */
  function confirmRemove(we: WorkoutExercise) {
    const n = we.sets.length;
    if (n > 0 && !window.confirm(`Remove ${exerciseNames.get(we.exercise_id) ?? "this exercise"} and its ${n} logged set${n === 1 ? "" : "s"}?`))
      return;
    removeExercise.mutateAsync(we.id).catch(showError);
  }

  /** Swapping clears the exercise's sets — ask first when there are any. */
  function confirmSwap(we: WorkoutExercise) {
    const n = we.sets.length;
    if (n > 0 && !window.confirm(`Swapping clears the ${n} set${n === 1 ? "" : "s"} logged for ${exerciseNames.get(we.exercise_id) ?? "this exercise"}. Continue?`))
      return;
    setSwapTarget(we);
  }

  function discard() {
    if (!session) return;
    if (!window.confirm("Discard this workout? Everything logged so far will be lost."))
      return;
    // Navigate first, mutate after — this page's own useWorkout(sessionId)
    // query would otherwise get invalidated out from under it (deleteWorkout
    // invalidates the whole ["workouts"] prefix, this session's key
    // included) and refetch a now-404ing workout while still mounted.
    router.push("/home");
    localStorage.removeItem(ORDER_KEY_PREFIX + sessionId);
    deleteWorkout.mutate(session.id);
  }

  if (!session && loadError) {
    // No error state used to mean an endless skeleton — and with the session
    // bar not rendered and the tab bar hidden here, no way out of it.
    const gone = loadError instanceof ApiRequestError && loadError.status === 404;
    return (
      <div className="pt-[calc(env(safe-area-inset-top)+64px)]">
        <Card flush>
          <EmptyState
            title={gone ? "This workout no longer exists" : "Couldn't load this workout"}
            description={gone ? "It may have been discarded." : loadError.message}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => router.push("/home")}>
                  Home
                </Button>
                {!gone && (
                  <Button onClick={() => refetch()} disabled={isFetching}>
                    {isFetching ? "Retrying…" : "Try again"}
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      </div>
    );
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
      <div
        data-session-bar
        className="fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-[480px] border-b border-separator bg-chrome pt-[env(safe-area-inset-top)] [backdrop-filter:blur(20px)]"
      >
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

          <button
            type="button"
            onClick={discard}
            disabled={deleteWorkout.isPending}
            aria-label="Discard workout"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-red active:bg-fill disabled:pointer-events-none disabled:opacity-40"
          >
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
              <path
                d="M1 4h14M6 4V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m4 0-.7 11.2a2 2 0 0 1-2 1.8H5.7a2 2 0 0 1-2-1.8L3 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Finish waits behind any queued set saves — say so rather than
              look unresponsive. */}
          <Button size="sm" onClick={finish} disabled={patchWorkout.isPending}>
            {patchWorkout.isPending ? "Saving…" : "Finish"}
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
                          key={keyOf(we)}
                          workoutExercise={we}
                          name={exerciseNames.get(we.exercise_id) ?? "Exercise"}
                          muscle={exerciseMuscle.get(we.exercise_id)}
                          mediaUrl={exerciseMedia.get(we.exercise_id)}
                          exerciseType={exerciseType.get(we.exercise_id)}
                          sessionId={sessionId}
                          onChangeSet={(setId, patch) => handleChangeSet(we, setId, patch)}
                          onDeleteSet={(setId) => deleteSet.mutateAsync(setId).catch(showError)}
                          onAddSet={() => handleAddSet(we.id)}
                          onRemove={() => confirmRemove(we)}
                          onSwap={() => confirmSwap(we)}
                          onDragHandlePointerDown={startDrag}
                          onActivate={() => setFocusedExerciseId(we.id)}
                          dimmed={
                            focusedExerciseId !== null && focusedExerciseId !== we.id
                          }
                        />
                      ));

                      return group.length > 1 && groupId !== null ? (
                        <SupersetGroup onUngroup={() => removeSuperset.mutateAsync(groupId).catch(showError)}>
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

      {actionError && (
        <div
          role="alert"
          // Above the finish summary (z-50) — a write that fails after Finish
          // must not be hidden under it.
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-[60] mx-auto w-full max-w-[480px] px-4"
        >
          <p className="rounded-control bg-red px-3 py-2 text-caption font-semibold text-white shadow-sheet">
            {actionError}
          </p>
        </div>
      )}

      {/* Rest timer, pinned above the safe area. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="pointer-events-auto">
          <RestTimer sessionId={sessionId} startSignal={restSignal} restSeconds={restSeconds} />
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
