"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { Sheet } from "@/components/ui/Sheet";
import { useExercises, useLastSet } from "@/hooks/use-exercises";
import { useMuscles } from "@/hooks/use-muscles";
import { formatDay, isTailMuscle, muscleImage } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const LONG_PRESS_MS = 450;

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  /** Restrict to the muscles the current split calls for. */
  allowedMuscleIds?: string[];
  /** Sheet title when no muscle is picked yet. */
  title?: string;
}

const LAST_EXERCISE_KEY = "overload_last_exercise_by_muscle";

function readLastByMuscle(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LAST_EXERCISE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function rememberLast(muscleId: string, exerciseId: string) {
  const current = readLastByMuscle();
  current[muscleId] = exerciseId;
  localStorage.setItem(LAST_EXERCISE_KEY, JSON.stringify(current));
}

/**
 * Muscle circles act as a live filter on one always-visible exercise list,
 * combined with the search box — tap a muscle (or several) to narrow the
 * list, type to narrow further, or do neither to browse everything. No
 * drill-down step: whatever's selected is applied instantly.
 */
export function ExercisePicker({
  open,
  onClose,
  onSelect,
  allowedMuscleIds,
  title = "Add exercise",
}: ExercisePickerProps) {
  const { data: muscles } = useMuscles();
  const { data: exercises, isLoading } = useExercises();
  const [selectedMuscleIds, setSelectedMuscleIds] = useState<Set<string>>(new Set());
  const [lastByMuscle, setLastByMuscle] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    if (open) setLastByMuscle(readLastByMuscle());
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedMuscleIds(new Set());
      setQuery("");
      setPreviewExercise(null);
    }
  }, [open]);

  const muscleName = useMemo(
    () => new Map(muscles?.map((m) => [m.id, m.name])),
    [muscles],
  );

  function toggleMuscle(id: string) {
    setSelectedMuscleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Every muscle is browsable; the split's own muscles just float to the
   *  top and get an accent dot, instead of hiding the rest — but cardio /
   *  full body / other always sort last regardless, even if the split
   *  happens to call for one of them. */
  const orderedMuscles = useMemo(() => {
    if (!muscles) return [];
    const allowed = new Set(allowedMuscleIds ?? []);
    return [...muscles].sort((a, b) => {
      const aTail = isTailMuscle(a.name) ? 1 : 0;
      const bTail = isTailMuscle(b.name) ? 1 : 0;
      if (aTail !== bTail) return aTail - bTail;
      const aIn = allowed.has(a.id) ? 0 : 1;
      const bIn = allowed.has(b.id) ? 0 : 1;
      return aIn - bIn;
    });
  }, [muscles, allowedMuscleIds]);

  /** Search text and the muscle-circle selection both narrow the same list,
   *  at once — the exercise last used for a muscle floats to the top of it,
   *  same "continuing a routine is one tap" shortcut as before. */
  const visibleExercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises ?? [])
      .filter((e) => {
        if (q && !e.name.toLowerCase().includes(q)) return false;
        if (selectedMuscleIds.size > 0 && !selectedMuscleIds.has(e.muscle_id)) return false;
        return true;
      })
      .sort((a, b) => {
        const aLast = lastByMuscle[a.muscle_id] === a.id ? 0 : 1;
        const bLast = lastByMuscle[b.muscle_id] === b.id ? 0 : 1;
        return aLast - bLast;
      });
  }, [exercises, query, selectedMuscleIds, lastByMuscle]);

  function choose(exercise: { id: string; muscle_id: string }) {
    rememberLast(exercise.muscle_id, exercise.id);
    onSelect(exercise.id);
    // Don't rely on the picker sheet's own close to cascade this — close
    // the preview the instant a selection is made, whether that came from
    // the preview's own "Select" button or a fresh tap on the row behind it.
    setPreviewExercise(null);
    onClose();
  }

  function renderRow(
    exercise: NonNullable<typeof exercises>[number],
    isLast: boolean,
    subtitle?: string,
  ) {
    // Plain closures, not hook state — this runs inside a .map(), so a real
    // useState/useRef here would change hook count between renders as the
    // list length changes. A held-down timer just needs to survive until
    // pointerup, which a closure captured by this row's own button does
    // fine without React involved at all.
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressed = false;

    function startPress() {
      longPressed = false;
      pressTimer = setTimeout(() => {
        longPressed = true;
        setPreviewExercise(exercise);
      }, LONG_PRESS_MS);
    }
    function endPress() {
      if (pressTimer) clearTimeout(pressTimer);
    }

    return (
      <button
        key={exercise.id}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onClick={(e) => {
          // The long-press already fired the preview — don't also select.
          if (longPressed) {
            e.preventDefault();
            return;
          }
          choose(exercise);
        }}
        className={cn(
          "flex min-h-14 cursor-pointer items-center gap-3 rounded-control select-none [-webkit-touch-callout:none]",
          "bg-background-secondary py-2 pr-4 pl-2 text-left active:opacity-70",
          isLast && "ring-1 ring-inset ring-accent-ink/60",
        )}
      >
        <MediaThumb
          src={exercise.thumbnail_url}
          alt=""
          fallback={
            <span className="text-caption font-bold text-label-tertiary">
              {exercise.name.slice(0, 1)}
            </span>
          }
          className="size-10 shrink-0 rounded-control"
        />
        <span className="min-w-0 flex-1 truncate text-body font-medium text-label">
          {exercise.name}
          {subtitle && (
            <span className="block truncate text-caption text-label-tertiary">
              {subtitle}
            </span>
          )}
        </span>
        {isLast && (
          <span className="shrink-0 rounded-pill bg-accent-muted px-2 py-1 text-tab font-bold text-accent-ink uppercase">
            Last time
          </span>
        )}
      </button>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="pb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          className="h-11 w-full rounded-control bg-fill px-4 text-body text-label placeholder:text-label-tertiary focus:outline-2 focus:outline-offset-0 focus:outline-blue"
        />
      </div>

      {/* Muscle filter — a horizontal strip of circles, not a browse step:
          tapping one narrows the list below instead of navigating to it. */}
      <div className="no-scrollbar -mx-4 mb-3 overflow-x-auto">
        <div className="flex gap-3 px-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <div className="size-14 animate-pulse rounded-pill bg-fill" />
                  <div className="h-3 w-10 animate-pulse rounded-full bg-fill" />
                </div>
              ))
            : orderedMuscles.map((m) => {
                const selected = selectedMuscleIds.has(m.id);
                const inSplit = allowedMuscleIds?.includes(m.id) ?? false;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMuscle(m.id)}
                    aria-pressed={selected}
                    aria-label={m.name}
                    className="flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1.5 active:opacity-70"
                  >
                    <span
                      className={cn(
                        "relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-fill",
                        selected && "ring-2 ring-accent-ink",
                      )}
                    >
                      <MediaThumb
                        src={muscleImage(m.name)}
                        alt=""
                        static
                        fallback={
                          <span className="text-caption font-bold text-label-tertiary">
                            {m.name.slice(0, 1)}
                          </span>
                        }
                        className="size-full object-cover"
                      />
                      {/* Split-relevant muscles get a quiet dot instead of a
                          ring, so it doesn't get confused with "selected". */}
                      {inSplit && !selected && (
                        <span className="absolute right-0.5 bottom-0.5 size-3 rounded-pill bg-accent ring-2 ring-background-elevated" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "w-full truncate text-center text-tab font-medium",
                        selected ? "text-accent-ink" : "text-label-secondary",
                      )}
                    >
                      {m.name}
                    </span>
                  </button>
                );
              })}
        </div>
      </div>

      {/* The one exercise list — filtered by search text and the muscle
          selection above, together. */}
      <div className="flex flex-col gap-2 pb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-control bg-fill" />
          ))
        ) : visibleExercises.length === 0 ? (
          <EmptyState
            title="No matches"
            description={
              query.trim()
                ? `Nothing found for "${query.trim()}".`
                : "No exercises for this muscle yet."
            }
          />
        ) : (
          visibleExercises.map((exercise) =>
            renderRow(
              exercise,
              lastByMuscle[exercise.muscle_id] === exercise.id,
              muscleName.get(exercise.muscle_id),
            ),
          )
        )}
      </div>

      <ExercisePreview
        exercise={previewExercise}
        muscleName={previewExercise ? muscleName.get(previewExercise.muscle_id) : undefined}
        onClose={() => setPreviewExercise(null)}
        onSelect={() => previewExercise && choose(previewExercise)}
      />
    </Sheet>
  );
}

/**
 * The long-press "peek" — a centered card over everything (including the
 * picker sheet), not another bottom sheet: this is a quick look, not a
 * second place to navigate.
 */
function ExercisePreview({
  exercise,
  muscleName,
  onClose,
  onSelect,
}: {
  exercise: Exercise | null;
  muscleName?: string;
  onClose: () => void;
  onSelect: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const { data: lastSet, isLoading: lastSetLoading } = useLastSet(exercise?.id ?? null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!exercise) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exercise, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {exercise && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={exercise.name}
            className="relative flex w-full max-w-[340px] flex-col overflow-hidden rounded-card bg-background-elevated shadow-sheet"
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.92 }}
            transition={
              reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 32 }
            }
          >
            <div className="relative h-48 w-full shrink-0 bg-fill">
              <MediaThumb
                src={exercise.video_url ?? exercise.thumbnail_url}
                alt={`${exercise.name} demonstration`}
                fallback={
                  <span className="text-stat text-label-tertiary">
                    {exercise.name.slice(0, 1)}
                  </span>
                }
                className="absolute inset-0 size-full"
              />
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div>
                <p className="text-body font-semibold text-label">{exercise.name}</p>
                {muscleName && (
                  <p className="text-caption text-label-tertiary">
                    {muscleName}
                    {exercise.equipment ? ` · ${exercise.equipment}` : ""}
                  </p>
                )}
              </div>
              {/* The whole point of a quick peek mid-picker: "did I already
                  do this, and with what?" — without leaving to the full
                  exercise history page. */}
              {!lastSetLoading && (
                <p className="text-caption text-label-secondary">
                  {lastSet ? (
                    <>
                      Last trained {formatDay(lastSet.logged_at)} ·{" "}
                      <span className="font-semibold text-label">
                        {lastSet.actual_weight ?? 0} kg × {lastSet.actual_reps ?? 0}
                      </span>
                    </>
                  ) : (
                    "Not logged yet"
                  )}
                </p>
              )}

              {exercise.tips && (
                <p className="text-caption text-label-secondary">{exercise.tips}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 flex-1 cursor-pointer rounded-button bg-fill text-body font-semibold text-label active:opacity-70"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onSelect}
                  className="h-11 flex-1 cursor-pointer rounded-button bg-accent text-body font-semibold text-accent-foreground active:opacity-70"
                >
                  Select
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
