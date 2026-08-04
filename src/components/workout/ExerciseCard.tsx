"use client";

import { Card } from "@/components/ui/Card";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { SetRow } from "@/components/workout/SetRow";
import { useExerciseHistory } from "@/hooks/use-exercises";
import { cn } from "@/lib/utils";
import type { Set, WorkoutExercise } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  name: string;
  muscle?: string;
  imageUrl?: string | null;
  onChangeSet: (setId: number, patch: Partial<Set>) => void;
  onDeleteSet: (setId: number) => void;
  onAddSet: () => void;
  onRemove: () => void;
  onSwap?: () => void;
  readOnly?: boolean;
  addPending?: boolean;
}

export function ExerciseCard({
  workoutExercise: we,
  name,
  muscle,
  imageUrl,
  onChangeSet,
  onDeleteSet,
  onAddSet,
  onRemove,
  onSwap,
  readOnly,
  addPending,
}: ExerciseCardProps) {
  const completed = we.sets.filter((s) => s.completed).length;

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
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <MediaThumb
            src={imageUrl}
            alt=""
            static
            fallback={
              <span className="text-caption font-bold text-label-tertiary">
                {name.slice(0, 1)}
              </span>
            }
            className="size-11 shrink-0 rounded-control"
          />
          <div className="min-w-0">
            {readOnly ? (
              <p className="truncate text-body font-semibold text-label">{name}</p>
            ) : (
              <Link
                href={`/exercises/${we.exercise_id}`}
                className="block truncate text-body font-semibold text-label active:opacity-60"
              >
                {name}
              </Link>
            )}
            <p className="text-subhead text-label-secondary">
              {muscle ? `${muscle} · ` : ""}
              {we.sets.length === 0
                ? "No sets yet"
                : `${completed}/${we.sets.length} sets`}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="-mt-2 -mr-2 flex shrink-0 items-center">
            {onSwap && (
              <button
                type="button"
                onClick={onSwap}
                aria-label={`Swap ${name}`}
                className="flex size-11 cursor-pointer items-center justify-center rounded-pill text-label-tertiary active:text-accent-ink"
              >
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
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
              className="flex size-11 cursor-pointer items-center justify-center rounded-pill text-label-tertiary active:text-red"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
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
      </div>

      {we.sets.length > 0 && (
        <div className="flex flex-col gap-2">
          {!readOnly && (
            <div className="grid grid-cols-[32px_1fr_64px_56px_44px] gap-2 px-2">
              <span />
              <span className="text-tab font-medium text-label-tertiary uppercase">
                Previous
              </span>
              <span className="text-center text-tab font-medium text-label-tertiary uppercase">
                Kg
              </span>
              <span className="text-center text-tab font-medium text-label-tertiary uppercase">
                Reps
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
                    onChange={(patch) => onChangeSet(set.id, patch)}
                    onDelete={() => onDeleteSet(set.id)}
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
