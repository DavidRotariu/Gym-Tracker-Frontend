"use client";

import { Card } from "@/components/ui/Card";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { SetRow } from "@/components/workout/SetRow";
import { useExerciseHistory } from "@/hooks/use-exercises";
import { cn } from "@/lib/utils";
import type { ExerciseType, Set, WorkoutExercise } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { setKeyAlias } from "@/hooks/use-workout-session";
import { scrollIntoViewQuietly } from "@/lib/scroll";
import { useEffect, useMemo, useRef, useState } from "react";

interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  name: string;
  muscle?: string;
  /** Prefer the video clip at this size — falls back to the still if the
   *  exercise has no video yet. */
  mediaUrl?: string | null;
  /** Governs which fields sets in this card log — see SetRow. */
  exerciseType?: ExerciseType;
  /** The workout being logged — excluded from the "Previous" lookup. */
  sessionId?: string;
  onChangeSet: (setId: string, patch: Partial<Set>) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
  onRemove: () => void;
  onSwap?: () => void;
  /** Starts dragging the enclosing group (see workout/[sessionId]/page.tsx) —
   *  omitted for a lone exercise that isn't part of a reorderable list. */
  onDragHandlePointerDown?: (e: React.PointerEvent) => void;
  readOnly?: boolean;
  addPending?: boolean;
  /** Dimmed to push focus onto whichever other card currently has it — see
   *  the session page's scroll-spy/focus tracking. */
  dimmed?: boolean;
  /** Called when this card should take focus without a tap (a set was just added). */
  onActivate?: () => void;
}

export function ExerciseCard({
  workoutExercise: we,
  name,
  muscle,
  mediaUrl,
  exerciseType,
  sessionId,
  onChangeSet,
  onDeleteSet,
  onAddSet,
  onRemove,
  onSwap,
  onDragHandlePointerDown,
  readOnly,
  addPending,
  dimmed,
  onActivate,
}: ExerciseCardProps) {
  const completed = we.sets.filter((s) => s.completed).length;

  // Mirrors whichever set's weight/reps field is being typed into, live,
  // into every *later, still-blank* set of the same field — the actual
  // commit (and its own forward-fill to persist that) only happens once
  // the field closes, this is purely the "as you type" preview.
  const [liveEdit, setLiveEdit] = useState<{
    setId: string;
    field: "weight" | "reps";
    draft: string;
  } | null>(null);

  function mirrorFor(setId: string, field: "weight" | "reps"): string | undefined {
    if (!liveEdit || liveEdit.field !== field || liveEdit.setId === setId) return undefined;
    const activeSet = we.sets.find((s) => s.id === liveEdit.setId);
    const thisSet = we.sets.find((s) => s.id === setId);
    // Same rule as the commit's forward-fill (see the session page): saved,
    // not completed, later — so the preview never shows a value that won't stick.
    if (!activeSet || !thisSet || thisSet.set_number <= activeSet.set_number) return undefined;
    if (thisSet.completed || thisSet.id.startsWith("optimistic-")) return undefined;
    const committed = field === "weight" ? thisSet.actual_weight : thisSet.actual_reps;
    return committed === null ? liveEdit.draft : undefined;
  }

  // Last time this exercise was trained, keyed by set number — powers the
  // "Previous" column so logging is a comparison, not a blank form.
  const { data: history } = useExerciseHistory(readOnly ? null : we.exercise_id);
  const previousBySetNumber = useMemo(() => {
    const map = new Map<number, { weight: number | null; reps: number | null }>();
    // The in-progress workout can show up in its own history as soon as it
    // has sets — skip it, or "Previous" turns into what you just logged.
    const lastEntry = history?.find((h) => h.workout_session_id !== sessionId);
    for (const s of lastEntry?.sets ?? []) {
      map.set(s.set_number, { weight: s.actual_weight, reps: s.actual_reps });
    }
    return map;
  }, [history, sessionId]);

  // Placeholder card (see useAddExercise) — the server hasn't confirmed it, so
  // anything that would hit it (add set, swap, remove) waits a beat.
  const unsaved = we.id.startsWith("optimistic-");
  // Only a card that *started* optimistic gets the entrance — one loaded from
  // the server must not replay it. Survives the id swap (same instance).
  const [entering] = useState(unsaved);

  // A set just added by the user (born optimistic, not in the first render):
  // scroll it into view once its height has unfolded, and hand the card focus.
  const seenSets = useRef<string[] | null>(null);
  const setKeys = we.sets.map((s) => setKeyAlias.get(s.id) ?? s.id).join("|");
  useEffect(() => {
    const keys = setKeys ? setKeys.split("|") : [];
    const seen = seenSets.current;
    seenSets.current = keys;
    if (!seen || readOnly) return;
    const fresh = keys.find((k) => !seen.includes(k) && k.startsWith("optimistic-"));
    if (!fresh) return;
    onActivate?.();
    const t = setTimeout(() => {
      const row = document
        .getElementById(`we-${we.id}`)
        ?.querySelector(`[data-set-key="${fresh}"]`);
      if (row) scrollIntoViewQuietly(row, "nearest");
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setKeys]);

  return (
    <Card
      id={`we-${we.id}`}
      data-order-index={we.order_index}
      flush
      className={cn(
        "exercise-card flex flex-col overflow-hidden",
        dimmed && "opacity-50",
        entering && "exercise-enter",
      )}
    >
      {/* The clip plays for real now (MediaThumb gates playback by on-screen
          visibility, not by omission) at a size where the movement — an
          actual demonstration of the exercise, not a 44px identicon — earns
          its keep mid-workout. Name/muscle/actions overlay it, same
          treatment as the "Up next" hero on Today. */}
      <div className="relative h-44 w-full shrink-0 bg-fill">
        <MediaThumb
          src={mediaUrl}
          alt=""
          fallback={
            <span className="text-stat-sm font-bold text-label-tertiary">
              {name.slice(0, 1)}
            </span>
          }
          className="absolute inset-0 size-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        {!readOnly && (
          <div className="absolute top-2 right-2 flex shrink-0 items-center rounded-pill bg-black/35 backdrop-blur-sm">
            {onDragHandlePointerDown && (
              <button
                type="button"
                onPointerDown={onDragHandlePointerDown}
                aria-label={`Drag to reorder ${name}`}
                className="flex size-10 touch-none cursor-grab items-center justify-center rounded-pill text-white/80 active:cursor-grabbing active:text-white"
              >
                <svg width="12" height="18" viewBox="0 0 12 18" fill="none" aria-hidden>
                  <circle cx="2.5" cy="3" r="1.5" fill="currentColor" />
                  <circle cx="9.5" cy="3" r="1.5" fill="currentColor" />
                  <circle cx="2.5" cy="9" r="1.5" fill="currentColor" />
                  <circle cx="9.5" cy="9" r="1.5" fill="currentColor" />
                  <circle cx="2.5" cy="15" r="1.5" fill="currentColor" />
                  <circle cx="9.5" cy="15" r="1.5" fill="currentColor" />
                </svg>
              </button>
            )}
            {onSwap && (
              <button
                type="button"
                onClick={onSwap}
                disabled={unsaved}
                aria-label={`Swap ${name}`}
                className="flex size-10 cursor-pointer items-center justify-center rounded-pill text-white/80 active:text-white disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M3 7h11.5M14.5 7 11 3.5M17 13H5.5M5.5 13 9 16.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              disabled={unsaved}
              aria-label={`Remove ${name}`}
              className="flex size-10 cursor-pointer items-center justify-center rounded-pill text-white/80 active:text-red disabled:opacity-40"
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Its own badge, not buried inline in the subtitle — the muscle
            group is the thing you scan for mid-workout ("what's next,
            legs or push?"), same treatment as the "Up next" hero chip on
            Today, so it reads as a tag rather than trailing text. */}
        {muscle && (
          <div className="absolute top-2 left-2">
            {/* A light-tinted chip disappears against the white background
                most demo clips are shot on — dark like the action pill on
                the other corner, which stays legible over any footage. */}
            <span className="rounded-pill bg-black/45 px-2.5 py-1 text-tab font-bold text-white uppercase backdrop-blur-sm">
              {muscle}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          {readOnly ? (
            <p className="truncate text-body font-semibold text-white">{name}</p>
          ) : (
            <Link
              href={`/exercises/${we.exercise_id}`}
              // No iOS link-preview callout on a long press mid-workout.
              className="block truncate text-body font-semibold text-white select-none active:opacity-70 [-webkit-touch-callout:none]"
            >
              {name}
            </Link>
          )}
          <p className="text-subhead text-white/70">
            {we.sets.length === 0 ? (
              "No sets yet"
            ) : (
              <>
                {/* Keyed on the count so it pops each time a set is ticked. */}
                <span
                  key={completed}
                  className={cn(
                    "tabular",
                    completed > 0 && "count-pop",
                    completed === we.sets.length && "font-semibold text-green",
                  )}
                >
                  {completed}
                </span>
                /{we.sets.length} sets
                {completed === we.sets.length && " ✓"}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {we.sets.length > 0 && (
          <div className="flex flex-col gap-2">
            {!readOnly && (
              <div
                className={cn(
                  "grid gap-2 px-2",
                  exerciseType !== "body_weight" && exerciseType !== "timer"
                    ? "grid-cols-[32px_1fr_64px_56px_44px]"
                    : "grid-cols-[32px_1fr_64px_44px]",
                )}
              >
                <span />
                <span className="text-tab font-medium text-label-tertiary uppercase">
                  Previous
                </span>
                {exerciseType !== "body_weight" && exerciseType !== "timer" && (
                  <span className="text-center text-tab font-medium text-label-tertiary uppercase">
                    Kg
                  </span>
                )}
                <span className="text-center text-tab font-medium text-label-tertiary uppercase">
                  {exerciseType === "timer" ? "Sec" : "Reps"}
                </span>
                <span />
              </div>
            )}
            <AnimatePresence initial={false}>
              {we.sets
                .slice()
                .sort((a, b) => a.set_number - b.set_number)
                .map((set) => (
                  // A newly-added row unfolds into place. Three things used to
                  // make this look off: (1) the key changed when the server's
                  // real id replaced the optimistic one, so the row exited and
                  // re-entered a beat later — setKeyAlias keeps the key stable;
                  // (2) the spring overshot and `scale` + `layout` fought the
                  // height animation — now a critically-damped height with a
                  // separate quick fade; (3) the contents spilled out while
                  // height was still 0 — overflow is clipped while animating.
                  <motion.div
                    key={setKeyAlias.get(set.id) ?? set.id}
                    data-set-key={setKeyAlias.get(set.id) ?? set.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      height: { type: "spring", stiffness: 380, damping: 40, mass: 0.9 },
                      opacity: { duration: 0.18 },
                    }}
                    className="scroll-mt-24 scroll-mb-44 overflow-hidden"
                  >
                    <SetRow
                      set={set}
                      previous={previousBySetNumber.get(set.set_number)}
                      readOnly={readOnly}
                      exerciseType={exerciseType}
                      onChange={(patch) => onChangeSet(set.id, patch)}
                      onDelete={() => onDeleteSet(set.id)}
                      weightOverride={mirrorFor(set.id, "weight")}
                      repsOverride={mirrorFor(set.id, "reps")}
                      onFieldDraft={(field, draft) => setLiveEdit({ setId: set.id, field, draft })}
                      onFieldEditEnd={(field) =>
                        setLiveEdit((current) =>
                          current?.setId === set.id && current.field === field ? null : current,
                        )
                      }
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        )}

        {!readOnly && (
          <AddSetButton
            label={we.sets.length === 0 ? "Log first set" : "Add set"}
            onAdd={onAddSet}
            pending={addPending || unsaved}
          />
        )}
      </div>
    </Card>
  );
}

/**
 * whileTap fires on pointer-*down*, not click — the press-in feedback is
 * instant, same beat as every other control in the app (apple-design §1).
 * The "+" glyph replaces itself with a fresh instance on every confirmed
 * add, springing in from a quarter-turn — a small stamp of causality so the
 * button visibly did something, not just the row list changing underneath.
 */
function AddSetButton({
  label,
  onAdd,
  pending,
}: {
  label: string;
  onAdd: () => void;
  pending?: boolean;
}) {
  const [pulse, setPulse] = useState(0);

  return (
    <motion.button
      type="button"
      data-add-set
      onClick={() => {
        setPulse((n) => n + 1);
        onAdd();
      }}
      disabled={pending}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-button bg-fill",
        "text-body font-semibold text-label",
        "disabled:opacity-40",
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.svg
          key={pulse}
          width="15"
          height="15"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          initial={{ opacity: 0, scale: 0.4, rotate: -60 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 480, damping: 22 }}
        >
          <path
            d="M7 1.5v11M1.5 7h11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </motion.svg>
      </AnimatePresence>
      {label}
    </motion.button>
  );
}
