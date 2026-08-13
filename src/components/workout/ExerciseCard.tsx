"use client";

import { Card } from "@/components/ui/Card";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { SetRow } from "@/components/workout/SetRow";
import { useExerciseHistory } from "@/hooks/use-exercises";
import { cn } from "@/lib/utils";
import type { ExerciseType, Set, WorkoutExercise } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  name: string;
  muscle?: string;
  /** Prefer the video clip at this size — falls back to the still if the
   *  exercise has no video yet. */
  mediaUrl?: string | null;
  /** Governs which fields sets in this card log — see SetRow. */
  exerciseType?: ExerciseType;
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
}

export function ExerciseCard({
  workoutExercise: we,
  name,
  muscle,
  mediaUrl,
  exerciseType,
  onChangeSet,
  onDeleteSet,
  onAddSet,
  onRemove,
  onSwap,
  onDragHandlePointerDown,
  readOnly,
  addPending,
  dimmed,
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
    if (!activeSet || !thisSet || thisSet.set_number <= activeSet.set_number) return undefined;
    const committed = field === "weight" ? thisSet.actual_weight : thisSet.actual_reps;
    return committed === null ? liveEdit.draft : undefined;
  }

  // Last time this exercise was trained, keyed by set number — powers the
  // "Previous" column so logging is a comparison, not a blank form.
  const { data: history } = useExerciseHistory(readOnly ? null : we.exercise_id);
  const previousBySetNumber = useMemo(() => {
    const map = new Map<number, { weight: number | null; reps: number | null }>();
    const lastEntry = history?.[0];
    for (const s of lastEntry?.sets ?? []) {
      map.set(s.set_number, { weight: s.actual_weight, reps: s.actual_reps });
    }
    return map;
  }, [history]);

  return (
    <Card
      id={`we-${we.id}`}
      flush
      className={cn(
        "exercise-card flex flex-col overflow-hidden",
        dimmed && "opacity-50",
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
                aria-label={`Swap ${name}`}
                className="flex size-10 cursor-pointer items-center justify-center rounded-pill text-white/80 active:text-white"
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
              aria-label={`Remove ${name}`}
              className="flex size-10 cursor-pointer items-center justify-center rounded-pill text-white/80 active:text-red"
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
              className="block truncate text-body font-semibold text-white active:opacity-70"
            >
              {name}
            </Link>
          )}
          <p className="text-subhead text-white/70">
            {we.sets.length === 0
              ? "No sets yet"
              : `${completed}/${we.sets.length} sets`}
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
                  // A newly-added row grows into place instead of just
                  // appearing — the visible half of "press Add set, see
                  // something happen" (apple-design §1: feedback should be
                  // continuous with the action, not a dead pop-in).
                  <motion.div
                    key={set.id}
                    layout="position"
                    initial={{ opacity: 0, scale: 0.94, height: 0 }}
                    animate={{ opacity: 1, scale: 1, height: "auto" }}
                    exit={{ opacity: 0, scale: 0.94, height: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
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
            pending={addPending}
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
