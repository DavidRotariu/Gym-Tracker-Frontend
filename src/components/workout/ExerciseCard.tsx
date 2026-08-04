"use client";

import { Card } from "@/components/ui/Card";
import { MediaThumb } from "@/components/ui/MediaThumb";
import { SetRow } from "@/components/workout/SetRow";
import { useExerciseHistory } from "@/hooks/use-exercises";
import { cn } from "@/lib/utils";
import type { Set, WorkoutExercise } from "@/types";
import Link from "next/link";
import { useMemo } from "react";

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
          {we.sets
            .slice()
            .sort((a, b) => a.set_number - b.set_number)
            .map((set) => (
              <SetRow
                key={set.id}
                set={set}
                previous={previousBySetNumber.get(set.set_number)}
                readOnly={readOnly}
                onChange={(patch) => onChangeSet(set.id, patch)}
                onDelete={() => onDeleteSet(set.id)}
              />
            ))}
        </div>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={onAddSet}
          disabled={addPending}
          className={cn(
            "h-11 cursor-pointer rounded-button bg-fill",
            "text-body font-semibold text-label",
            "active:opacity-70 disabled:opacity-40",
          )}
        >
          {we.sets.length === 0 ? "Log first set" : "Add set"}
        </button>
      )}
    </Card>
  );
}
